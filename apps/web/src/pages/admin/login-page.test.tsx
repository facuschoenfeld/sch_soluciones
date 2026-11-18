// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { renderWithProviders } from '@/test/render';
import { LoginPage } from './login-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const loginCalls = (calls: ApiCall[]) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/api/auth/login');

const loginOk = () => Response.json({ data: { email: ADMIN_EMAIL } });

async function setup({
  route = '/admin/login',
  loginResponse = loginOk,
}: { route?: string; loginResponse?: () => Response } = {}) {
  const api = stubAdminApi({
    session: null,
    handler: (call) =>
      call.method === 'POST' && call.path === '/api/auth/login' ? loginResponse() : undefined,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<LoginPage />, { route });
  await screen.findByRole('button', { name: 'Ingresar' });
  return { ...api, ...view, user };
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  it('valida el email en el cliente sin llamar a la API', async () => {
    const { user, calls } = await setup();
    await fillAndSubmit(user, 'no-es-un-email', 'algo');

    await waitFor(() =>
      expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true'),
    );
    expect(loginCalls(calls)).toHaveLength(0);
  });

  it('exige la contraseña sin llamar a la API', async () => {
    const { user, calls } = await setup();
    await fillAndSubmit(user, ADMIN_EMAIL, '');

    expect(await screen.findByText('Ingresá la contraseña')).toBeTruthy();
    expect(loginCalls(calls)).toHaveLength(0);
  });

  it('con credenciales correctas envía el login y navega a /admin', async () => {
    const { user, calls, router } = await setup();
    await fillAndSubmit(user, ADMIN_EMAIL, 'una-clave-larga-123');

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
    expect(loginCalls(calls)[0]?.body).toEqual({
      email: ADMIN_EMAIL,
      password: 'una-clave-larga-123',
    });
  });

  it('navega al destino `next` cuando es una ruta válida del panel', async () => {
    const { user, router } = await setup({
      route: `/admin/login?next=${encodeURIComponent('/admin/configuracion')}`,
    });
    await fillAndSubmit(user, ADMIN_EMAIL, 'una-clave-larga-123');

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/configuracion'));
  });

  it.each(['//evil.com', 'https://evil.com', '/administrador'])(
    'ignora el `next` inseguro %s y va a /admin',
    async (next) => {
      const { user, router } = await setup({
        route: `/admin/login?next=${encodeURIComponent(next)}`,
      });
      await fillAndSubmit(user, ADMIN_EMAIL, 'una-clave-larga-123');

      await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
    },
  );

  it('con 401 muestra el error de credenciales y limpia la contraseña', async () => {
    const { user, router } = await setup({
      loginResponse: () => errorResponse(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas'),
    });
    await fillAndSubmit(user, ADMIN_EMAIL, 'incorrecta');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Email o contraseña incorrectos.');
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(ADMIN_EMAIL);
    expect(router.state.location.pathname).toBe('/admin/login');
  });

  it('con 429 muestra el mensaje de demasiados intentos', async () => {
    const { user } = await setup({
      loginResponse: () => errorResponse(429, 'RATE_LIMITED', 'Demasiados intentos'),
    });
    await fillAndSubmit(user, ADMIN_EMAIL, 'algo');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Demasiados intentos. Esperá unos minutos y probá de nuevo.');
  });

  it('con un error de servidor muestra el mensaje genérico', async () => {
    const { user } = await setup({
      loginResponse: () => errorResponse(500, 'INTERNAL_ERROR', 'Error'),
    });
    await fillAndSubmit(user, ADMIN_EMAIL, 'algo');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('El servidor tuvo un problema');
  });

  it('con sesión abierta redirige fuera del login', async () => {
    stubAdminApi({ session: { email: ADMIN_EMAIL } });
    const { router } = renderWithProviders(<LoginPage />, {
      route: `/admin/login?next=${encodeURIComponent('/admin/clientes')}`,
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clientes'));
    expect(screen.queryByRole('button', { name: 'Ingresar' })).toBeNull();
  });
});
