// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { makeClientDetail } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { ClientFormPage } from './client-form-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const callsTo = (calls: ApiCall[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path);

function setup({
  route = '/admin/clientes/nuevo',
  path = '/admin/clientes/nuevo',
  extra = () => undefined,
}: {
  route?: string;
  path?: string;
  extra?: (call: ApiCall) => Response | undefined;
} = {}) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'POST' && call.path === '/api/admin/clients') {
        return Response.json(
          { data: makeClientDetail({ id: 42, ...(call.body as object) }) },
          { status: 201 },
        );
      }
      if (call.method === 'GET' && call.path === '/api/admin/clients/7') {
        return Response.json({ data: makeClientDetail({ id: 7 }) });
      }
      if (call.method === 'PATCH' && call.path === '/api/admin/clients/7') {
        return Response.json({ data: makeClientDetail({ id: 7, ...(call.body as object) }) });
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<ClientFormPage />, { route, path });
  return { ...api, ...view, user: userEvent.setup() };
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Crear cliente' }));

describe('ClientFormPage (alta)', () => {
  it('valida que el nombre y el teléfono sean obligatorios y no envía nada', async () => {
    const { user, calls } = setup();
    await screen.findByLabelText('Nombre y apellido');

    await submit(user);

    expect(await screen.findByText('Ingresá el nombre')).toBeTruthy();
    expect(screen.getByText('Ingresá el teléfono')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/clients')).toHaveLength(0);
  });

  it('un teléfono con letras o muy corto se rechaza', async () => {
    const { user, calls } = setup();
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), 'abc');

    await submit(user);

    expect(await screen.findByText(/Solo números/)).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/clients')).toHaveLength(0);
  });

  it('un email inválido se rechaza', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '5491122334455');
    await user.type(screen.getByLabelText('Email (opcional)'), 'no-es-email');

    await submit(user);

    expect(await screen.findByText('Ingresá un email válido')).toBeTruthy();
  });

  it('con un teléfono sin código de país muestra el aviso (sin bloquear el alta)', async () => {
    const { user, calls } = setup();
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '1122334455');

    expect(
      screen.getByText(/Sin código de país no se le puede escribir por WhatsApp/),
    ).toBeTruthy();
    await submit(user);

    await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/clients')).toHaveLength(1));
  });

  it('con el número completo no hay aviso, solo la pista', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '5491122334455');

    expect(screen.queryByText(/Sin código de país no se le puede/)).toBeNull();
    expect(screen.getByText(/Con código de país para escribirle por WhatsApp/)).toBeTruthy();
  });

  it('crea el cliente: POST con teléfono en solo dígitos y va a la ficha', async () => {
    const { user, calls, router } = setup();
    await user.type(await screen.findByLabelText('Nombre y apellido'), '  Ana Pérez ');
    await user.type(screen.getByLabelText('Teléfono'), '+54 9 11 2233-4455');
    await user.selectOptions(screen.getByLabelText('¿Cómo llegó?'), 'REFERRAL');

    await submit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clientes/42'));
    const [post] = callsTo(calls, 'POST', '/api/admin/clients');
    expect(post?.body).toMatchObject({
      fullName: 'Ana Pérez',
      phone: '5491122334455',
      source: 'REFERRAL',
    });
  });

  it('con ?volver=trabajo vuelve al alta de trabajos con el cliente creado', async () => {
    const { user, router } = setup({ route: '/admin/clientes/nuevo?volver=trabajo' });
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '5491122334455');

    await submit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/trabajos/nuevo'));
    expect(router.state.location.search).toBe('?cliente=42');
  });

  it('un volver distinto de "trabajo" se ignora y va a la ficha', async () => {
    const { user, router } = setup({ route: '/admin/clientes/nuevo?volver=otra-cosa' });
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '5491122334455');

    await submit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clientes/42'));
  });

  it('un error por campo de la API se marca en el campo (no es un aviso general)', async () => {
    const { user, router } = setup({
      extra: (call) =>
        call.method === 'POST'
          ? errorResponse(400, 'VALIDATION_ERROR', 'Datos inválidos', [
              { path: ['phone'], message: 'Ese teléfono ya está cargado' },
            ])
          : undefined,
    });
    await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '5491122334455');

    await submit(user);

    expect(await screen.findByText('Ese teléfono ya está cargado')).toBeTruthy();
    expect(screen.getByLabelText('Teléfono').getAttribute('aria-invalid')).toBe('true');
    expect(router.state.location.pathname).toBe('/admin/clientes/nuevo');
  });
});

describe('ClientFormPage (edición)', () => {
  const editRoute = { route: '/admin/clientes/7/editar', path: '/admin/clientes/:id/editar' };

  it('precarga los datos del cliente', async () => {
    setup(editRoute);

    expect(((await screen.findByLabelText('Nombre y apellido')) as HTMLInputElement).value).toBe(
      'Ana Pérez',
    );
    expect((screen.getByLabelText('Teléfono') as HTMLInputElement).value).toBe('5491122334455');
    expect((screen.getByLabelText('Dirección (opcional)') as HTMLInputElement).value).toBe(
      'Calle 123',
    );
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
  });

  it('guarda con PATCH y vuelve a la ficha', async () => {
    const { user, calls, router } = setup(editRoute);
    const name = await screen.findByLabelText('Nombre y apellido');

    await user.clear(name);
    await user.type(name, 'Ana María');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clientes/7'));
    expect(callsTo(calls, 'PATCH', '/api/admin/clients/7')[0]?.body).toMatchObject({
      fullName: 'Ana María',
    });
  });

  it('un cliente inexistente muestra "El cliente no existe"', async () => {
    setup({
      ...editRoute,
      extra: (call) =>
        call.method === 'GET' && call.path === '/api/admin/clients/7'
          ? errorResponse(404, 'CLIENT_NOT_FOUND', 'No existe')
          : undefined,
    });

    expect(await screen.findByText('El cliente no existe')).toBeTruthy();
  });
});
