// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { SESSION_QUERY_KEY } from '@/lib/query-client';
import { SettingsPage } from './settings-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const passwordCalls = (calls: ApiCall[]) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/api/admin/password');

function setup(passwordResponse: () => Response = () => new Response(null, { status: 204 })) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) =>
      call.method === 'POST' && call.path === '/api/admin/password'
        ? passwordResponse()
        : undefined,
  });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, { email: ADMIN_EMAIL });
  renderWithProviders(<SettingsPage />, { route: '/admin/configuracion', queryClient });
  return { ...api, user: userEvent.setup() };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  { current = '', next = '', confirm = '' },
) {
  if (current) await user.type(field('Contraseña actual'), current);
  if (next) await user.type(field('Contraseña nueva'), next);
  if (confirm) await user.type(field('Repetí la contraseña nueva'), confirm);
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('SettingsPage (cambiar contraseña)', () => {
  it('rechaza una contraseña nueva menor a 12 caracteres', async () => {
    const { user, calls } = setup();
    await fill(user, { current: 'actual-larga-123', next: 'corta', confirm: 'corta' });

    expect(await screen.findByText('La contraseña debe tener al menos 12 caracteres')).toBeTruthy();
    expect(passwordCalls(calls)).toHaveLength(0);
  });

  it('rechaza una confirmación distinta', async () => {
    const { user, calls } = setup();
    await fill(user, {
      current: 'actual-larga-123',
      next: 'nueva-larga-1234',
      confirm: 'otra-distinta-123',
    });

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeTruthy();
    expect(passwordCalls(calls)).toHaveLength(0);
  });

  it('rechaza una nueva igual a la actual', async () => {
    const { user, calls } = setup();
    await fill(user, {
      current: 'misma-clave-1234',
      next: 'misma-clave-1234',
      confirm: 'misma-clave-1234',
    });

    expect(
      await screen.findByText('La nueva contraseña tiene que ser distinta de la actual'),
    ).toBeTruthy();
    expect(passwordCalls(calls)).toHaveLength(0);
  });

  it('exige la contraseña actual', async () => {
    const { user, calls } = setup();
    await fill(user, { next: 'nueva-larga-1234', confirm: 'nueva-larga-1234' });

    expect(await screen.findByText('Ingresá tu contraseña actual')).toBeTruthy();
    expect(passwordCalls(calls)).toHaveLength(0);
  });

  it('con éxito envía solo currentPassword y newPassword, avisa y resetea el formulario', async () => {
    const { user, calls } = setup();
    await fill(user, {
      current: 'actual-larga-123',
      next: 'nueva-larga-1234',
      confirm: 'nueva-larga-1234',
    });

    expect(await screen.findByText('Listo: tu contraseña se actualizó.')).toBeTruthy();
    const sent = passwordCalls(calls);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      currentPassword: 'actual-larga-123',
      newPassword: 'nueva-larga-1234',
    });
    expect(field('Contraseña actual').value).toBe('');
    expect(field('Contraseña nueva').value).toBe('');
    expect(field('Repetí la contraseña nueva').value).toBe('');
  });

  it('con 400 INVALID_CURRENT_PASSWORD marca el campo Contraseña actual', async () => {
    const { user } = setup(() =>
      errorResponse(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual es incorrecta', [
        { path: ['currentPassword'], message: 'La contraseña actual es incorrecta' },
      ]),
    );
    await fill(user, {
      current: 'equivocada-123',
      next: 'nueva-larga-1234',
      confirm: 'nueva-larga-1234',
    });

    expect(await screen.findByText('La contraseña actual es incorrecta')).toBeTruthy();
    expect(field('Contraseña actual').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Listo: tu contraseña se actualizó.')).toBeNull();
  });

  it('con 429 muestra el mensaje general de demasiados intentos', async () => {
    const { user } = setup(() => errorResponse(429, 'RATE_LIMITED', 'Demasiados intentos'));
    await fill(user, {
      current: 'actual-larga-123',
      next: 'nueva-larga-1234',
      confirm: 'nueva-larga-1234',
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Demasiados intentos. Esperá unos minutos y probá de nuevo.');
  });

  it('con un error de servidor muestra el mensaje general y conserva lo escrito', async () => {
    const { user } = setup(() => errorResponse(500, 'INTERNAL_ERROR', 'Error'));
    await fill(user, {
      current: 'actual-larga-123',
      next: 'nueva-larga-1234',
      confirm: 'nueva-larga-1234',
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cambiar la contraseña');
    await waitFor(() => expect(field('Contraseña actual').value).toBe('actual-larga-123'));
  });
});

describe('SettingsPage (cerrar sesión en todos los dispositivos)', () => {
  function setupSessions(response: () => Response = () => new Response(null, { status: 204 })) {
    const api = stubAdminApi({
      session: { email: ADMIN_EMAIL },
      handler: (call) =>
        call.method === 'POST' && call.path === '/api/admin/logout-all' ? response() : undefined,
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, { email: ADMIN_EMAIL });
    const view = renderWithProviders(<SettingsPage />, {
      route: '/admin/configuracion',
      queryClient,
    });
    return { ...api, ...view, user: userEvent.setup() };
  }

  it('pide confirmación y no llama a la API si se cancela', async () => {
    const { user, calls } = setupSessions();
    await user.click(
      screen.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(calls.some((c) => c.path === '/api/admin/logout-all')).toBe(false);
  });

  it('al confirmar cierra todas las sesiones y va al login', async () => {
    const { user, calls, router } = setupSessions();
    await user.click(
      screen.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cerrar todas' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/admin/logout-all')).toBe(true);
    expect(router.state.location.state).toMatchObject({ loggedOut: true });
  });

  it('si falla muestra el error y no navega', async () => {
    const { user, router } = setupSessions(() => errorResponse(500, 'INTERNAL_ERROR', 'Error'));
    await user.click(
      screen.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cerrar todas' }));

    expect(await screen.findByText(/No se pudieron cerrar las sesiones/)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/admin/configuracion');
  });
});
