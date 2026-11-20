/**
 * Caché en memoria con vencimiento, para las respuestas públicas. Con una sola instancia de la
 * API alcanza: evita que una ráfaga de visitas (o un script) consulte la base en cada request
 * y mantenga despierto el cómputo de Neon. Solo se guardan resultados exitosos.
 */
export interface TtlCache {
  get<T>(key: string, load: () => Promise<T>): Promise<T>;
  /** Descarta todo (se llama al editar el catálogo o la configuración desde el panel). */
  clear(): void;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export function createTtlCache(
  ttlMs: number,
  { maxEntries = 100, now = Date.now }: { maxEntries?: number; now?: () => number } = {},
): TtlCache {
  const entries = new Map<string, Entry>();
  // Consultas en curso: pedidos simultáneos con la caché vacía comparten una sola consulta.
  const inFlight = new Map<string, Promise<unknown>>();
  // Cada clear() abre una generación nueva: una consulta que arrancó antes no puede volver a
  // guardar datos viejos (ej. precios leídos antes de editarlos desde el panel).
  let generation = 0;

  function store(key: string, value: unknown): void {
    entries.delete(key);
    // Tope de entradas: las claves dependen de la URL (ej. ?category=), no deben crecer sin fin.
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, { value, expiresAt: now() + ttlMs });
  }

  return {
    async get<T>(key: string, load: () => Promise<T>): Promise<T> {
      if (ttlMs <= 0) return load();

      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value as T;

      const pending = inFlight.get(key);
      if (pending) return pending as Promise<T>;

      const startedAt = generation;
      const promise: Promise<T> = load()
        .then((value) => {
          if (startedAt === generation) store(key, value);
          return value;
        })
        .finally(() => {
          if (inFlight.get(key) === promise) inFlight.delete(key);
        });
      inFlight.set(key, promise);
      return promise;
    },
    clear() {
      generation++;
      entries.clear();
      inFlight.clear();
    },
  };
}
