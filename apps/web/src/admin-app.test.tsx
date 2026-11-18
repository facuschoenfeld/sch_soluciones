// @vitest-environment jsdom
import type { QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { SESSION_QUERY_KEY, queryClient as appQueryClient } from '@/lib/query-client';
import {
  ADMIN_EMAIL,
  errorResponse,
  stubAdminApi,
  stubMatchMedia,
  type AdminApiOptions,
} from '@/test/admin-api';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import AdminApp from './admin-app';

beforeEach(() => {
  stubMatchMedia();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  appQueryClient.clear();
  localStorage.clear();
});

function renderPanel(
  route: string,
  options: AdminApiOptions = {},
  queryClient: QueryClient = createTestQueryClient(),
) {
  const api = stubAdminApi(options);
  const view = renderWithProviders(<AdminApp />, { route, path: '/admin/*', queryClient });
  return { ...api, ...view, user: userEvent.setup() };
}

const withSession = { session: { email: ADMIN_EMAIL } };

describe('AdminApp: rutas protegidas', () => {
  it('sin sesión redirige al login conservando el destino en ?next=', async () => {
    const { router } = renderPanel('/admin/configuracion', { session: null });

    await screen.findByRole('heading', { name: 'Panel de administración' });
    const { pathname, search } = router.state.location;
    expect(pathname).toBe('/admin/login');
    expect(search).toBe('?next=%2Fadmin%2Fconfiguracion');
  });

  it('con sesión muestra el layout y la página pedida', async () => {
    renderPanel('/admin/configuracion', withSession);

    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Panel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByText(ADMIN_EMAIL)).toBeTruthy();
  });

  it('mientras verifica la sesión muestra el estado de carga', () => {
    renderPanel('/admin', withSession);
    expect(screen.getByText('Cargando el panel…')).toBeTruthy();
  });

  it('si /auth/me falla con 500 muestra el error con Reintentar, y reintenta', async () => {
    const { user, calls, state } = renderPanel('/admin', { ...withSession, meStatus: 500 });

    expect(await screen.findByText('No se pudo verificar tu sesión')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Panel' })).toBeNull();
    const meCalls = () => calls.filter((c) => c.path === '/api/auth/me').length;
    expect(meCalls()).toBe(1);
    expect(state.session).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(meCalls()).toBe(2));
  });

  it('una ruta desconocida del panel vuelve al inicio', async () => {
    const { router } = renderPanel('/admin/no-existe', withSession);

    await screen.findByRole('heading', { name: 'Inicio' });
    expect(router.state.location.pathname).toBe('/admin');
  });
});

describe('AdminApp: layout', () => {
  it('el nav marca la sección activa con aria-current="page"', async () => {
    const { user } = renderPanel('/admin', withSession);
    const nav = await screen.findByRole('navigation', { name: 'Panel' });

    const current = () =>
      within(nav)
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page')
        .map((link) => link.textContent);

    expect(current()).toEqual(['Inicio']);

    await user.click(within(nav).getByRole('link', { name: 'Clientes' }));
    await screen.findByRole('heading', { name: 'Clientes' });
    expect(current()).toEqual(['Clientes']);
  });

  it('"Cerrar sesión" hace POST /api/auth/logout, limpia la sesión y vuelve al login', async () => {
    const { user, calls, router, queryClient } = renderPanel('/admin', withSession);
    await screen.findByRole('heading', { name: 'Inicio' });

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/auth/logout')).toBe(true);
    // La sesión la limpia el login al montarse.
    await waitFor(() => expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull());
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeTruthy();
    // Cierre a propósito: sin ?next= y sin aviso de error.
    expect(router.state.location.search).toBe('');
    expect(screen.queryByText(/No se pudo confirmar el cierre/)).toBeNull();
  });

  it('si el logout falla igual cierra la sesión del lado del front', async () => {
    const { user, router, queryClient } = renderPanel('/admin', {
      ...withSession,
      handler: (call) =>
        call.method === 'POST' && call.path === '/api/auth/logout'
          ? errorResponse(500, 'INTERNAL_ERROR', 'Error')
          : undefined,
    });
    await screen.findByRole('heading', { name: 'Inicio' });

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
    // La sesión la limpia el login al montarse.
    await waitFor(() => expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull());
    // Avisa que la cookie podría seguir activa.
    expect(await screen.findByText(/No se pudo confirmar el cierre de sesión/)).toBeTruthy();
  });

  it('agrega <meta name="robots" content="noindex, nofollow"> mientras está montado', async () => {
    const selector = 'meta[name="robots"]';
    expect(document.head.querySelector(selector)).toBeNull();

    const { unmount } = renderPanel('/admin', withSession);
    await screen.findByRole('heading', { name: 'Inicio' });
    const metas = document.head.querySelectorAll(selector);
    expect(metas).toHaveLength(1);
    expect(metas[0]?.getAttribute('content')).toBe('noindex, nofollow');

    unmount();
    expect(document.head.querySelector(selector)).toBeNull();
  });
});

describe('queryClient global: manejo de 401', () => {
  it('una consulta que recibe 401 deja la sesión en null', async () => {
    appQueryClient.setQueryData(SESSION_QUERY_KEY, { email: ADMIN_EMAIL });

    await appQueryClient
      .fetchQuery({
        queryKey: ['admin', 'algo'],
        queryFn: () => Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'No autorizado')),
      })
      .catch(() => undefined);

    expect(appQueryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });

  it('una mutación que recibe 401 deja la sesión en null', async () => {
    appQueryClient.setQueryData(SESSION_QUERY_KEY, { email: ADMIN_EMAIL });

    await appQueryClient
      .getMutationCache()
      .build(appQueryClient, {
        mutationFn: () => Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'No autorizado')),
      })
      .execute(undefined)
      .catch(() => undefined);

    expect(appQueryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });

  it('una mutación con expectsUnauthorized (login) no toca la sesión', async () => {
    appQueryClient.setQueryData(SESSION_QUERY_KEY, { email: ADMIN_EMAIL });

    await appQueryClient
      .getMutationCache()
      .build(appQueryClient, {
        mutationFn: () => Promise.reject(new ApiError(401, 'INVALID_CREDENTIALS', 'Mal')),
        meta: { expectsUnauthorized: true },
      })
      .execute(undefined)
      .catch(() => undefined);

    expect(appQueryClient.getQueryData(SESSION_QUERY_KEY)).toEqual({ email: ADMIN_EMAIL });
  });

  it('otros errores (500, 403) no cierran la sesión', async () => {
    appQueryClient.setQueryData(SESSION_QUERY_KEY, { email: ADMIN_EMAIL });

    for (const status of [500, 403]) {
      await appQueryClient
        .fetchQuery({
          queryKey: ['admin', 'otro', status],
          queryFn: () => Promise.reject(new ApiError(status, 'X', 'Error')),
        })
        .catch(() => undefined);
    }

    expect(appQueryClient.getQueryData(SESSION_QUERY_KEY)).toEqual({ email: ADMIN_EMAIL });
  });

  it('en el panel, un 401 al cambiar la contraseña redirige al login', async () => {
    const { user, router } = renderPanel(
      '/admin/configuracion',
      {
        ...withSession,
        handler: (call) =>
          call.method === 'POST' && call.path === '/api/admin/password'
            ? errorResponse(401, 'UNAUTHORIZED', 'Sesión vencida')
            : undefined,
      },
      appQueryClient,
    );
    await screen.findByRole('heading', { name: 'Configuración' });

    await user.type(screen.getByLabelText('Contraseña actual'), 'actual-larga-123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-larga-1234');
    await user.type(screen.getByLabelText('Repetí la contraseña nueva'), 'nueva-larga-1234');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
    expect(router.state.location.search).toBe('?next=%2Fadmin%2Fconfiguracion');
  });
});
