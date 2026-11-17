import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

/**
 * Renderiza dentro de un router en memoria y un QueryClient sin reintentos.
 * `path` es el patrón de la ruta (ej.: `/servicios/:slug`) para que `useParams` funcione.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*', queryClient = createTestQueryClient() } = {},
) {
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
