import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { expectsUnauthorized?: boolean };
  }
}

/** Un error 4xx (ej. servicio inexistente) no se arregla reintentando. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

/** Clave de la sesión del panel: `AuthUser` con sesión, `null` sin sesión. */
export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

/**
 * Cierra la sesión del lado del front: borra de la caché todo lo que no sea público (datos del
 * panel, que desde la Fase 5 incluyen clientes) y marca la sesión como cerrada.
 */
export function clearPanelData(client: QueryClient): void {
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== 'public' && query.queryKey[0] !== 'auth',
  });
  // Las mutaciones guardan sus variables (email, contraseñas y, desde la Fase 5, datos de
  // clientes): también se descartan.
  client.getMutationCache().clear();
  client.setQueryData(SESSION_QUERY_KEY, null);
}

/**
 * Si cualquier consulta o mutación del panel recibe 401 (sesión vencida o cerrada en otro
 * dispositivo), se marca la sesión como cerrada y las rutas protegidas redirigen al login.
 * Las mutaciones con `meta.expectsUnauthorized` (el login, donde 401 = credenciales
 * incorrectas) quedan afuera.
 */
function handleUnauthorized(error: unknown, expectsUnauthorized = false): void {
  if (expectsUnauthorized) return;
  if (error instanceof ApiError && error.status === 401) {
    clearPanelData(queryClient);
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => handleUnauthorized(error) }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      handleUnauthorized(error, mutation.meta?.expectsUnauthorized === true),
  }),
  defaultOptions: {
    queries: {
      // El catálogo cambia poco: evita refetch innecesarios (y despertar la base en Neon).
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});
