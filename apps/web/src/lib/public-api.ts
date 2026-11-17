import type {
  DataResponse,
  PublicCategory,
  PublicServiceDetail,
  PublicServiceSummary,
  PublicSettings,
} from '@sch/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';

// Hooks de la API pública. Las claves agrupan por recurso para poder invalidarlas juntas.

export const publicQueryKeys = {
  settings: ['public', 'settings'] as const,
  categories: ['public', 'categories'] as const,
  services: (filters: ServicesFilters) => ['public', 'services', filters] as const,
  service: (slug: string) => ['public', 'service', slug] as const,
};

export interface ServicesFilters {
  category?: string;
  q?: string;
}

async function getData<T>(path: string): Promise<T> {
  const body = await apiGet<DataResponse<T>>(path);
  return body.data;
}

export function useSettings() {
  return useQuery({
    queryKey: publicQueryKeys.settings,
    queryFn: () => getData<PublicSettings>('/public/settings'),
  });
}

const FALLBACK_BUSINESS_NAME = 'SCH Soluciones';

/** Nombre del negocio de Settings; mientras carga (o si quedó vacío), el de respaldo. */
export function useBusinessName(): string {
  return useSettings().data?.businessName.trim() || FALLBACK_BUSINESS_NAME;
}

export function useCategories() {
  return useQuery({
    queryKey: publicQueryKeys.categories,
    queryFn: () => getData<PublicCategory[]>('/public/categories'),
  });
}

export function useServices(filters: ServicesFilters = {}, { enabled = true } = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.q) params.set('q', filters.q);
  const query = params.toString();

  return useQuery({
    queryKey: publicQueryKeys.services(filters),
    queryFn: () => getData<PublicServiceSummary[]>(`/public/services${query ? `?${query}` : ''}`),
    // Al cambiar filtros se siguen mostrando los resultados anteriores hasta tener los nuevos.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useService(slug: string) {
  return useQuery({
    queryKey: publicQueryKeys.service(slug),
    queryFn: () => getData<PublicServiceDetail>(`/public/services/${encodeURIComponent(slug)}`),
  });
}
