import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

/** Un error 4xx (ej. servicio inexistente) no se arregla reintentando. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El catálogo cambia poco: evita refetch innecesarios (y despertar la base en Neon).
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});
