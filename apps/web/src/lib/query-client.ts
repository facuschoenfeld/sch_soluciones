import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El catálogo cambia poco: evita refetch innecesarios (y despertar la base en Neon).
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
