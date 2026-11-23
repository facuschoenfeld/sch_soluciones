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
 * `state`: el `location.state` inicial (ej. `{ from }` al llegar desde un listado).
 */
function parseRoute(route: string) {
  const url = new URL(route, 'http://localhost');
  return { pathname: url.pathname, search: url.search };
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    queryClient = createTestQueryClient(),
    state,
  }: { route?: string; path?: string; queryClient?: QueryClient; state?: unknown } = {},
) {
  const router = createMemoryRouter([{ path, element: ui }], {
    initialEntries: [state === undefined ? route : { ...parseRoute(route), state }],
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
