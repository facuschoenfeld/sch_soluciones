import type {
  AdminCategory,
  AdminClientDetail,
  AdminClientSummary,
  AdminDashboard,
  AdminJob,
  AdminServiceDetail,
  AdminServiceSummary,
  AdminSettings,
  BulkPriceInput,
  BulkPriceResult,
  CategoryInput,
  CategoryUpdate,
  ClientInput,
  DataResponse,
  JobInput,
  JobUpdate,
  Paginated,
  ServiceInput,
  ServiceUpdate,
  SettingsUpdate,
} from '@sch/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { ApiError, apiGet, apiSend } from '@/lib/api-client';

// Hooks de la API del panel. Las claves empiezan con 'admin': al cerrar sesión se borran
// (clearPanelData) y nunca se mezclan con las públicas.

export const adminQueryKeys = {
  all: ['admin'] as const,
  categories: ['admin', 'categories'] as const,
  services: ['admin', 'services'] as const,
  service: (id: number) => ['admin', 'services', id] as const,
  settings: ['admin', 'settings'] as const,
  clients: ['admin', 'clients'] as const,
  clientList: (query: string) => ['admin', 'clients', 'list', query] as const,
  client: (id: number) => ['admin', 'clients', 'detail', id] as const,
  jobs: ['admin', 'jobs'] as const,
  jobList: (query: string) => ['admin', 'jobs', 'list', query] as const,
  job: (id: number) => ['admin', 'jobs', 'detail', id] as const,
  dashboard: ['admin', 'dashboard'] as const,
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
    // 404 (se borró un servicio) o 409 (cambió un precio): se recarga la lista para que la
    // vista previa muestre lo que hay ahora, sin tener que recargar la página.
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        return invalidateCatalog(queryClient);
      }
    },
  });
}

// --- Configuración ---------------------------------------------------------

const fetchAdminSettings = () => getData<AdminSettings>('/admin/settings');

export function useAdminSettings() {
  return useQuery({ queryKey: adminQueryKeys.settings, queryFn: fetchAdminSettings, staleTime: 0 });
}

/** Lee la configuración guardada ahora (sin caché) y actualiza la del panel. */
export function refetchAdminSettings(queryClient: QueryClient): Promise<AdminSettings> {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.settings,
    queryFn: fetchAdminSettings,
    staleTime: 0,
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsUpdate) => sendData<AdminSettings>('PUT', '/admin/settings', input),
    onSuccess: (settings) => {
      queryClient.setQueryData(adminQueryKeys.settings, settings);
      // El nombre del negocio y las plantillas también se usan en el panel y en el sitio.
      return queryClient.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

// --- Clientes y trabajos (mini CRM) ----------------------------------------

/**
 * Después de escribir un cliente o un trabajo: se refrescan listados, fichas y métricas. Los
 * trabajos cambian los totales del cliente y si un servicio se puede borrar (sus trabajos).
 * `skip`: la ficha recién guardada (ya está en la caché con la respuesta) o recién borrada (si
 * se recargara, la página mostraría "no existe" antes de salir).
 */
function invalidateCrm(
  queryClient: QueryClient,
  { skip, services = false }: { skip?: QueryKey; services?: boolean } = {},
): Promise<void> {
  const notSkipped = ({ queryKey }: { queryKey: QueryKey }) =>
    !skip || JSON.stringify(queryKey) !== JSON.stringify(skip);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.clients, predicate: notSkipped }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.jobs, predicate: notSkipped }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
    // Solo los trabajos cambian algo del catálogo (cuántos tiene cada servicio).
    services && queryClient.invalidateQueries({ queryKey: adminQueryKeys.services }),
  ]).then(() => undefined);
}

/** `query` es el query string ya armado (sin "?"): también es la clave de la caché. */
export function useAdminClients(query: string) {
  return useQuery({
    queryKey: adminQueryKeys.clientList(query),
    queryFn: () => apiGet<Paginated<AdminClientSummary>>(`/admin/clients?${query}`),
    // Al cambiar de página o de búsqueda se sigue viendo la lista anterior hasta que llega la nueva.
    placeholderData: keepPreviousData,
  });
}

export function useAdminClient(id: number | undefined) {
  return useQuery({
    queryKey: adminQueryKeys.client(id ?? 0),
    queryFn: () => getData<AdminClientDetail>(`/admin/clients/${id}`),
    enabled: id !== undefined,
  });
}

export function useSaveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: ClientInput }) =>
      id === undefined
        ? sendData<AdminClientDetail>('POST', '/admin/clients', input)
        : sendData<AdminClientDetail>('PATCH', `/admin/clients/${id}`, input),
    onSuccess: (client) => {
      queryClient.setQueryData(adminQueryKeys.client(client.id), client);
      return invalidateCrm(queryClient, { skip: adminQueryKeys.client(client.id) });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend('DELETE', `/admin/clients/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: adminQueryKeys.client(id) });
      return invalidateCrm(queryClient, { skip: adminQueryKeys.client(id) });
    },
  });
}

export function useAdminJobs(query: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: adminQueryKeys.jobList(query),
    queryFn: () => apiGet<Paginated<AdminJob>>(`/admin/jobs?${query}`),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useAdminJob(id: number | undefined) {
  return useQuery({
    queryKey: adminQueryKeys.job(id ?? 0),
    queryFn: () => getData<AdminJob>(`/admin/jobs/${id}`),
    enabled: id !== undefined,
    // El formulario siempre parte de lo guardado.
    staleTime: 0,
  });
}

/** Alta, edición del formulario (solo los campos cambiados) y cambios de estado. */
export function useSaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: JobInput | JobUpdate }) =>
      id === undefined
        ? sendData<AdminJob>('POST', '/admin/jobs', input)
        : sendData<AdminJob>('PATCH', `/admin/jobs/${id}`, input),
    onSuccess: (job) => {
      queryClient.setQueryData(adminQueryKeys.job(job.id), job);
      return invalidateCrm(queryClient, { skip: adminQueryKeys.job(job.id), services: true });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend('DELETE', `/admin/jobs/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: adminQueryKeys.job(id) });
      return invalidateCrm(queryClient, { skip: adminQueryKeys.job(id), services: true });
    },
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminQueryKeys.dashboard,
    queryFn: () => getData<AdminDashboard>('/admin/dashboard'),
    staleTime: 0,
  });
}
