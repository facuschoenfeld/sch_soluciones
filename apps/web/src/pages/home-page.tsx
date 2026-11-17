import type { HealthResponse } from '@sch/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';

// Página provisoria de la Fase 1: solo verifica que el front llega a la API vía proxy.
export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthResponse>('/health'),
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">SCH Soluciones</h1>
      <p className="mt-2 text-muted-foreground">Sitio en construcción.</p>

      <p className="mt-8 text-sm" role="status" aria-live="polite">
        Estado de la API: {health.isPending && <span>verificando…</span>}
        {health.isError && <span className="text-destructive">sin conexión</span>}
        {health.isSuccess && <span className="text-green-700">operativa</span>}
      </p>
    </section>
  );
}
