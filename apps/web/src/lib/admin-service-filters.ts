import type { AdminServiceSummary } from '@sch/shared';

// Filtros en la URL: al volver del formulario de un servicio se mantienen.
export const STATUS_OPTIONS = {
  todos: 'Todos',
  activos: 'Activos',
  archivados: 'Archivados',
} as const;
export const SORT_OPTIONS = {
  sitio: 'Orden del sitio',
  nombre: 'Nombre',
  precio: 'Precio',
  actualizacion: 'Precio más viejo primero',
} as const;
type StatusFilter = keyof typeof STATUS_OPTIONS;
type SortOption = keyof typeof SORT_OPTIONS;

function pick<T extends string>(value: string | null, options: Record<T, string>, fallback: T): T {
  return value !== null && Object.hasOwn(options, value) ? (value as T) : fallback;
}

export interface ServiceFilters {
  q: string;
  categoryId: number | null;
  status: StatusFilter;
  sort: SortOption;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Filtra y ordena en el navegador: el catálogo es chico y ya está completo en memoria. */
export function filterServices(
  services: AdminServiceSummary[],
  { q, categoryId, status, sort }: ServiceFilters,
): AdminServiceSummary[] {
  const query = normalize(q.trim());
  const result = services.filter(
    (service) =>
      (categoryId === null || service.categoryId === categoryId) &&
      (status === 'todos' || service.isActive === (status === 'activos')) &&
      (!query ||
        normalize(`${service.name} ${service.slug} ${service.shortDescription}`).includes(query)),
  );

  const byName = (a: AdminServiceSummary, b: AdminServiceSummary) =>
    a.name.localeCompare(b.name, 'es');
  if (sort === 'nombre') return result.sort(byName);
  if (sort === 'actualizacion') {
    return result.sort((a, b) => a.priceUpdatedAt.localeCompare(b.priceUpdatedAt));
  }
  if (sort === 'precio') {
    // Por moneda y monto; los "a consultar" al final.
    return result.sort(
      (a, b) =>
        Number(a.priceAmount === null) - Number(b.priceAmount === null) ||
        a.currency.localeCompare(b.currency) ||
        (a.priceAmount ?? 0) - (b.priceAmount ?? 0) ||
        byName(a, b),
    );
  }
  // Orden del sitio: categorías como las devuelve la API y, dentro de cada una, por sortOrder
  // (así un reordenamiento optimista se ve antes de que responda la API).
  const categoryRank = new Map<number, number>();
  for (const service of services) {
    if (!categoryRank.has(service.categoryId)) {
      categoryRank.set(service.categoryId, categoryRank.size);
    }
  }
  return result.sort(
    (a, b) =>
      (categoryRank.get(a.categoryId) ?? 0) - (categoryRank.get(b.categoryId) ?? 0) ||
      a.sortOrder - b.sortOrder ||
      byName(a, b),
  );
}

export function parseFilters(params: URLSearchParams): ServiceFilters {
  const rawCategory = Number(params.get('categoria'));
  return {
    q: params.get('q') ?? '',
    categoryId: Number.isInteger(rawCategory) && rawCategory > 0 ? rawCategory : null,
    status: pick(params.get('estado'), STATUS_OPTIONS, 'todos'),
    sort: pick(params.get('orden'), SORT_OPTIONS, 'sitio'),
  };
}
