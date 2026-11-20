import type {
  AdminCategory,
  AdminServiceDetail,
  AdminServiceSummary,
  AdminSettings,
  BulkPriceInput,
  BulkPriceResult,
  CategoryInput,
  CategoryUpdate,
  DataResponse,
  ServiceInput,
  ServiceUpdate,
  SettingsInput,
} from '@sch/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiSend } from '@/lib/api-client';

// Hooks de la API del panel. Las claves empiezan con 'admin': al cerrar sesión se borran
// (clearPanelData) y nunca se mezclan con las públicas.

export const adminQueryKeys = {
  all: ['admin'] as const,
  categories: ['admin', 'categories'] as const,
  services: ['admin', 'services'] as const,
  service: (id: number) => ['admin', 'services', id] as const,
  settings: ['admin', 'settings'] as const,
};

async function getData<T>(path: string): Promise<T> {
  return (await apiGet<DataResponse<T>>(path)).data;
}

async function sendData<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body: unknown,
): Promise<T> {
  return (await apiSend<DataResponse<T>>(method, path, body)).data;
}

/**
 * Después de editar el catálogo: se refrescan las listas del panel y se descarta lo público en
 * caché (así "Ver el sitio" muestra el cambio sin recargar).
 */
function invalidateCatalog(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.categories }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.services }),
    queryClient.invalidateQueries({ queryKey: ['public'] }),
  ]).then(() => undefined);
}

/** Mensaje para un toast de error: el de la API si es un error esperado (4xx), si no genérico. */
export function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    if (error.status === 429) return 'Demasiadas peticiones. Esperá unos minutos.';
    return error.message;
  }
  return fallback;
}

// --- Categorías ------------------------------------------------------------

export function useAdminCategories() {
  return useQuery({
    queryKey: adminQueryKeys.categories,
    queryFn: () => getData<AdminCategory[]>('/admin/categories'),
  });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: CategoryInput }) =>
      id === undefined
        ? sendData<AdminCategory>('POST', '/admin/categories', input)
        : sendData<AdminCategory>('PATCH', `/admin/categories/${id}`, input),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CategoryUpdate }) =>
      sendData<AdminCategory>('PATCH', `/admin/categories/${id}`, patch),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend('DELETE', `/admin/categories/${id}`),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

/**
 * Reordenar: se muestra el orden nuevo al instante (optimista) y, si la API falla, se vuelve
 * al anterior.
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => apiSend('PUT', '/admin/categories/order', { ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: adminQueryKeys.categories });
      const previous = queryClient.getQueryData<AdminCategory[]>(adminQueryKeys.categories);
      if (previous) {
        const byId = new Map(previous.map((category) => [category.id, category]));
        queryClient.setQueryData(
          adminQueryKeys.categories,
          ids.flatMap((id, index) => {
            const category = byId.get(id);
            return category ? [{ ...category, sortOrder: index }] : [];
          }),
        );
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(adminQueryKeys.categories, context.previous);
    },
    onSettled: () => invalidateCatalog(queryClient),
  });
}

// --- Servicios -------------------------------------------------------------

export function useAdminServices() {
  return useQuery({
    queryKey: adminQueryKeys.services,
    queryFn: () => getData<AdminServiceSummary[]>('/admin/services'),
  });
}

export function useAdminService(id: number | undefined) {
  return useQuery({
    queryKey: adminQueryKeys.service(id ?? 0),
    queryFn: () => getData<AdminServiceDetail>(`/admin/services/${id}`),
    enabled: id !== undefined,
    // El formulario siempre parte de lo guardado.
    staleTime: 0,
  });
}

export function useSaveService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: ServiceInput }) =>
      id === undefined
        ? sendData<AdminServiceDetail>('POST', '/admin/services', input)
        : sendData<AdminServiceDetail>('PATCH', `/admin/services/${id}`, input),
    onSuccess: (service) => {
      queryClient.setQueryData(adminQueryKeys.service(service.id), service);
      return invalidateCatalog(queryClient);
    },
  });
}

/** Cambios puntuales desde la tabla: precio, destacado, archivar/restaurar. */
export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: ServiceUpdate }) =>
      sendData<AdminServiceDetail>('PATCH', `/admin/services/${id}`, patch),
    onSuccess: (service, { patch }) => {
      queryClient.setQueryData(adminQueryKeys.service(service.id), service);
      // Cambiar de categoría mueve el servicio (orden y conteos): ahí sí se recarga todo.
      if (patch.categoryId !== undefined) return invalidateCatalog(queryClient);
      // Si no, se reemplaza la fila con la respuesta: editar precios uno por uno no dispara
      // varias GET por clic (cuentan para el límite de peticiones de la API).
      const { description: _description, whatsappTemplate: _template, ...summary } = service;
      queryClient.setQueryData<AdminServiceSummary[]>(adminQueryKeys.services, (list) =>
        list?.map((item) => (item.id === summary.id ? summary : item)),
      );
      return queryClient.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend('DELETE', `/admin/services/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: adminQueryKeys.service(id) });
      return invalidateCatalog(queryClient);
    },
  });
}

export function useReorderServices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { categoryId: number; ids: number[] }) =>
      apiSend('PUT', '/admin/services/order', input),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: adminQueryKeys.services });
      const previous = queryClient.getQueryData<AdminServiceSummary[]>(adminQueryKeys.services);
      if (previous) {
        const position = new Map(ids.map((id, index) => [id, index]));
        queryClient.setQueryData(
          adminQueryKeys.services,
          previous.map((service) => {
            const sortOrder = position.get(service.id);
            return sortOrder === undefined ? service : { ...service, sortOrder };
          }),
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(adminQueryKeys.services, context.previous);
    },
    onSettled: () => invalidateCatalog(queryClient),
  });
}

export const BULK_PRICE_MUTATION_KEY = ['admin', 'bulk-price'] as const;

export function useBulkPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: BULK_PRICE_MUTATION_KEY,
    mutationFn: (input: BulkPriceInput) =>
      sendData<BulkPriceResult>('POST', '/admin/services/bulk-price', input),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

// --- Configuración ---------------------------------------------------------

export function useAdminSettings() {
  return useQuery({
    queryKey: adminQueryKeys.settings,
    queryFn: () => getData<AdminSettings>('/admin/settings'),
    staleTime: 0,
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => sendData<AdminSettings>('PUT', '/admin/settings', input),
    onSuccess: (settings) => {
      queryClient.setQueryData(adminQueryKeys.settings, settings);
      // El nombre del negocio y las plantillas también se usan en el panel y en el sitio.
      return queryClient.invalidateQueries({ queryKey: ['public'] });
    },
  });
}
