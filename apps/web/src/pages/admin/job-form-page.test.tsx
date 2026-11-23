// @vitest-environment jsdom
import type { AdminJob } from '@sch/shared';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import {
  makeClient,
  makeClientDetail,
  makeJob,
  makeService,
  paginated,
} from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { JobFormPage } from './job-form-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const callsTo = (calls: ApiCall[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path);

const windows = makeService({
  id: 1,
  name: 'Instalación de Windows',
  priceAmount: 30000,
  currency: 'ARS',
});
const hosting = makeService({
  id: 2,
  categoryId: 2,
  name: 'Alojamiento web',
  priceAmount: 10,
  currency: 'USD',
  category: { id: 2, name: 'Desarrollo web', line: 'DEVELOPMENT', isActive: true },
});
const quote = makeService({
  id: 3,
  categoryId: 2,
  name: 'Sistema a medida',
  priceType: 'QUOTE',
  priceAmount: null,
  category: { id: 2, name: 'Desarrollo web', line: 'DEVELOPMENT', isActive: true },
});

interface SetupOptions {
  route?: string;
  path?: string;
  job?: AdminJob;
  extra?: (call: ApiCall) => Response | undefined;
  state?: unknown;
}

function setup({
  route = '/admin/trabajos/nuevo?cliente=1',
  path = '/admin/trabajos/nuevo',
  job = makeJob({ id: 5 }),
  extra = () => undefined,
  state,
}: SetupOptions = {}) {
  let stored = job;
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'GET' && call.path === '/api/admin/services') {
        return Response.json({ data: [windows, hosting, quote] });
      }
      if (call.method === 'GET' && call.path === '/api/admin/clients/1') {
        return Response.json({ data: makeClientDetail({ id: 1 }) });
      }
      if (call.method === 'GET' && call.path === '/api/admin/clients') {
        return Response.json(paginated([makeClient({ id: 1 })]));
      }
      if (call.method === 'POST' && call.path === '/api/admin/jobs') {
        return Response.json({ data: makeJob({ id: 99 }) }, { status: 201 });
      }
      if (call.method === 'GET' && call.path === '/api/admin/jobs/5') {
        return Response.json({ data: stored });
      }
      if (call.method === 'PATCH' && call.path === '/api/admin/jobs/5') {
        stored = { ...stored, ...(call.body as object) };
        return Response.json({ data: stored });
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<JobFormPage />, { route, path, state });
  return { ...api, ...view, user: userEvent.setup() };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const register = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Registrar trabajo' }));
const setDate = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });

describe('JobFormPage (alta)', () => {
  it('con ?cliente= precarga el cliente (sin buscador) y vuelve a su ficha al crear', async () => {
    const { user, router } = setup();

    const group = await screen.findByRole('group', { name: /Elegí el cliente/ });
    expect(within(group).getByText('Ana Pérez')).toBeTruthy();
    expect(within(group).getByText('5491122334455')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Nombre, teléfono o email')).toBeNull();

    await user.type(field('Título'), 'Reparar notebook');
    await register(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clientes/1'));
  });

  it('un ?cliente= inválido se ignora y se pide elegir uno', async () => {
    const { calls } = setup({ route: '/admin/trabajos/nuevo?cliente=abc' });

    expect(await screen.findByPlaceholderText('Nombre, teléfono o email')).toBeTruthy();
    expect(callsTo(calls, 'GET', '/api/admin/clients/abc')).toHaveLength(0);
  });

  it('sin cliente: "Elegí un cliente" y no se envía nada', async () => {
    const { user, calls } = setup({ route: '/admin/trabajos/nuevo' });
    await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');

    await register(user);

    expect(await screen.findByText('Elegí un cliente')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(0);
  });

  it('se puede elegir un cliente de la lista y después crear', async () => {
    const { user, calls } = setup({ route: '/admin/trabajos/nuevo' });
    await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');

    await user.click(await screen.findByRole('button', { name: /Ana Pérez/ }));
    expect(screen.getByRole('button', { name: /Cambiar/ })).toBeTruthy();
    await register(user);

    await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(1));
    expect(callsTo(calls, 'POST', '/api/admin/jobs')[0]?.body).toMatchObject({ clientId: 1 });
  });

  it('ofrece crear el cliente y volver al alta del trabajo', async () => {
    setup({ route: '/admin/trabajos/nuevo' });

    const link = await screen.findByRole('link', { name: /Crear cliente/ });
    expect(link.getAttribute('href')).toBe('/admin/clientes/nuevo?volver=trabajo');
  });

  it('el título es obligatorio', async () => {
    const { user, calls } = setup();
    await screen.findByLabelText('Título');

    await register(user);

    expect(await screen.findByText('Ingresá un título')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(0);
  });

  describe('servicio del catálogo', () => {
    it('elegir un servicio precarga título, total y moneda', async () => {
      const { user } = setup();
      await user.selectOptions(
        await screen.findByLabelText('Servicio del catálogo (opcional)'),
        'Alojamiento web',
      );

      expect(field('Título').value).toBe('Alojamiento web');
      expect(field('Total (USD)').value).toBe('10');
      expect((screen.getByLabelText('Moneda') as HTMLSelectElement).value).toBe('USD');
    });

    it('no pisa un título que ya se escribió', async () => {
      const { user } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Mi título');

      await user.selectOptions(
        screen.getByLabelText('Servicio del catálogo (opcional)'),
        'Instalación de Windows',
      );

      expect(field('Título').value).toBe('Mi título');
      expect(field('Total (ARS)').value).toBe('30000');
    });

    it('cambiar de servicio actualiza el título que había puesto el servicio anterior', async () => {
      const { user } = setup();
      const select = await screen.findByLabelText('Servicio del catálogo (opcional)');

      await user.selectOptions(select, 'Instalación de Windows');
      await user.selectOptions(select, 'Alojamiento web');

      expect(field('Título').value).toBe('Alojamiento web');
    });

    it('un servicio "a consultar" precarga el título pero no toca el total', async () => {
      const { user } = setup();
      const select = await screen.findByLabelText('Servicio del catálogo (opcional)');
      await user.selectOptions(select, 'Instalación de Windows');

      await user.selectOptions(select, 'Sistema a medida');

      expect(field('Total (ARS)').value).toBe('30000');
    });

    it('un servicio de soporte técnico muestra los datos del equipo; uno de desarrollo no', async () => {
      const { user } = setup();
      const select = await screen.findByLabelText('Servicio del catálogo (opcional)');
      expect(screen.queryByRole('heading', { name: 'Equipo' })).toBeNull();

      await user.selectOptions(select, 'Alojamiento web');
      expect(screen.queryByRole('heading', { name: 'Equipo' })).toBeNull();

      await user.selectOptions(select, 'Instalación de Windows');
      expect(screen.getByRole('heading', { name: 'Equipo' })).toBeTruthy();
    });

    it('se manda el serviceId elegido', async () => {
      const { user, calls } = setup();
      await user.selectOptions(
        await screen.findByLabelText('Servicio del catálogo (opcional)'),
        'Instalación de Windows',
      );

      await register(user);

      await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(1));
      expect(callsTo(calls, 'POST', '/api/admin/jobs')[0]?.body).toMatchObject({
        serviceId: 1,
        title: 'Instalación de Windows',
        amountCharged: 30000,
        currency: 'ARS',
      });
    });
  });

  describe('cobro', () => {
    it('"Marcar como pagado" copia el total en "Pagado" y el botón desaparece', async () => {
      const { user } = setup();
      await user.clear(await screen.findByLabelText('Total (ARS)'));
      await user.type(field('Total (ARS)'), '25.000');

      expect(screen.getByText(/Saldo:/).textContent).toContain('25.000');
      await user.click(screen.getByRole('button', { name: 'Marcar como pagado' }));

      expect(field('Pagado (ARS)').value).toBe('25000');
      expect(screen.queryByRole('button', { name: 'Marcar como pagado' })).toBeNull();
      expect(screen.queryByText(/Saldo:/)).toBeNull();
    });

    it('lo pagado no puede superar el total', async () => {
      const { user, calls } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Trabajo');
      await user.clear(field('Total (ARS)'));
      await user.type(field('Total (ARS)'), '1000');
      await user.clear(field('Pagado (ARS)'));
      await user.type(field('Pagado (ARS)'), '2000');

      await register(user);

      expect(await screen.findByText(/no puede (ser mayor|superar)/i)).toBeTruthy();
      expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(0);
    });

    it('un monto que no es número se marca como inválido', async () => {
      const { user, calls } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Trabajo');
      await user.clear(field('Total (ARS)'));
      await user.type(field('Total (ARS)'), 'abc');

      await register(user);

      expect(await screen.findByText('Ingresá un monto válido')).toBeTruthy();
      expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(0);
    });
  });

  describe('envío', () => {
    it('manda las fechas en ISO: el ingreso es el inicio del día en hora argentina', async () => {
      const { user, calls } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');
      setDate('Ingreso', '2026-11-23');
      fireEvent.change(field('Turno (opcional)'), { target: { value: '2026-11-24T15:30' } });
      setDate('Terminado (opcional)', '2026-11-25');

      await register(user);

      await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(1));
      expect(callsTo(calls, 'POST', '/api/admin/jobs')[0]?.body).toMatchObject({
        receivedAt: '2026-11-23T03:00:00.000Z',
        scheduledAt: '2026-11-24T18:30:00.000Z',
        completedAt: '2026-11-25T03:00:00.000Z',
      });
    });

    it('sin turno ni fecha de terminado manda null', async () => {
      const { user, calls } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');

      await register(user);

      await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(1));
      expect(callsTo(calls, 'POST', '/api/admin/jobs')[0]?.body).toMatchObject({
        scheduledAt: null,
        completedAt: null,
        status: 'QUOTED',
        serviceId: null,
        clientId: 1,
      });
    });

    it('manda deviceInfo con las 4 claves', async () => {
      const { user, calls } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');
      await user.click(screen.getByRole('button', { name: 'Agregar datos del equipo' }));
      await user.type(await screen.findByLabelText('Marca'), 'HP');
      await user.type(field('Modelo'), 'Pavilion');
      await user.type(field('N° de serie'), 'SN-123');
      await user.type(field('Falla reportada'), 'No enciende');

      await register(user);

      await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(1));
      expect((callsTo(calls, 'POST', '/api/admin/jobs')[0]?.body as AdminJob).deviceInfo).toEqual({
        brand: 'HP',
        model: 'Pavilion',
        serialNumber: 'SN-123',
        reportedIssue: 'No enciende',
      });
    });

    it('sin datos del equipo igual manda las 4 claves (vacías: la API las guarda como null)', async () => {
      const { user, calls } = setup();
      await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');

      await register(user);

      await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/jobs')).toHaveLength(1));
      const body = callsTo(calls, 'POST', '/api/admin/jobs')[0]?.body as AdminJob;
      expect(Object.keys(body.deviceInfo ?? {}).sort()).toEqual([
        'brand',
        'model',
        'reportedIssue',
        'serialNumber',
      ]);
    });

    it('un error por campo de la API se marca en el campo', async () => {
      const { user, router } = setup({
        extra: (call) =>
          call.method === 'POST'
            ? errorResponse(400, 'VALIDATION_ERROR', 'Datos inválidos', [
                { path: ['serviceId'], message: 'El servicio no existe' },
              ])
            : undefined,
      });
      await user.type(await screen.findByLabelText('Título'), 'Reparar notebook');

      await register(user);

      expect(await screen.findByText('El servicio no existe')).toBeTruthy();
      expect(
        screen.getByLabelText('Servicio del catálogo (opcional)').getAttribute('aria-invalid'),
      ).toBe('true');
      expect(router.state.location.pathname).toBe('/admin/trabajos/nuevo');
    });
  });
});

describe('JobFormPage (edición)', () => {
  const editRoute = { route: '/admin/trabajos/5', path: '/admin/trabajos/:id' };

  it('"Volver" y "Cancelar" vuelven a donde se estaba (inicio o listado filtrado)', async () => {
    setup({ ...editRoute, state: { from: '/admin' } });
    const back = await screen.findByRole('link', { name: 'Volver' });
    expect(back.getAttribute('href')).toBe('/admin');
    expect((await screen.findByRole('link', { name: 'Cancelar' })).getAttribute('href')).toBe(
      '/admin',
    );
  });

  it('un origen fuera del panel se ignora (vuelve a la ficha del cliente)', async () => {
    setup({ ...editRoute, state: { from: 'https://evil.example' } });
    const back = await screen.findByRole('link', { name: 'Volver a la ficha del cliente' });
    expect(back.getAttribute('href')).toMatch(/^\/admin\/clientes\/\d+$/);
  });

  it('precarga el trabajo y muestra el control de estado', async () => {
    setup(editRoute);

    expect(((await screen.findByLabelText('Título')) as HTMLInputElement).value).toBe(
      'Reparar notebook',
    );
    expect(field('Ingreso').value).toBe('2026-11-20');
    expect(screen.getByRole('button', { name: /Pasar a Agendado/ })).toBeTruthy();
    // El estado no se edita en el formulario: lo maneja el control aparte.
    expect(screen.queryByLabelText('Estado', { selector: '#job-status' })).toBeNull();
  });

  it('cambiar el título manda solo { title }', async () => {
    const { user, calls } = setup(editRoute);
    const title = await screen.findByLabelText('Título');

    await user.clear(title);
    await user.type(title, 'Reparar notebook Lenovo');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')).toHaveLength(1));
    expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')[0]?.body).toEqual({
      title: 'Reparar notebook Lenovo',
    });
  });

  it('después de guardar, el siguiente guardado manda solo lo que cambió desde entonces', async () => {
    const { user, calls } = setup(editRoute);
    const title = await screen.findByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Nuevo título');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')).toHaveLength(1));

    await user.type(field('Descripción (opcional)'), 'Cambié la pantalla');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')).toHaveLength(2));
    expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')[1]?.body).toEqual({
      description: 'Cambié la pantalla',
    });
  });

  it('cambiar el cobro manda solo los montos tocados', async () => {
    const { user, calls } = setup(editRoute);
    const paid = await screen.findByLabelText('Pagado (ARS)');

    await user.clear(paid);
    await user.type(paid, '4.000');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')).toHaveLength(1));
    expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')[0]?.body).toEqual({ amountPaid: 4000 });
  });

  it('cambiar la fecha de ingreso manda solo receivedAt en ISO', async () => {
    const { user, calls } = setup(editRoute);
    await screen.findByLabelText('Ingreso');

    setDate('Ingreso', '2026-11-22');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')).toHaveLength(1));
    expect(callsTo(calls, 'PATCH', '/api/admin/jobs/5')[0]?.body).toEqual({
      receivedAt: '2026-11-22T03:00:00.000Z',
    });
  });

  it('un error por campo de la API (amountPaid) se marca en el campo y no navega', async () => {
    const { user, router } = setup({
      ...editRoute,
      extra: (call) =>
        call.method === 'PATCH'
          ? errorResponse(400, 'VALIDATION_ERROR', 'Datos inválidos', [
              { path: ['amountPaid'], message: 'Lo pagado no puede superar el total' },
            ])
          : undefined,
    });
    const paid = await screen.findByLabelText('Pagado (ARS)');
    await user.clear(paid);
    await user.type(paid, '500');

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Lo pagado no puede superar el total')).toBeTruthy();
    expect(screen.getByLabelText('Pagado (ARS)').getAttribute('aria-invalid')).toBe('true');
    expect(router.state.location.pathname).toBe('/admin/trabajos/5');
  });

  it('un error sin campo (409 JOB_CHANGED) no marca ningún campo', async () => {
    const { user } = setup({
      ...editRoute,
      extra: (call) =>
        call.method === 'PATCH'
          ? errorResponse(409, 'JOB_CHANGED', 'El trabajo cambió mientras tanto')
          : undefined,
    });
    const title = await screen.findByLabelText('Título');
    await user.type(title, ' x');

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy(),
    );
    expect(title.getAttribute('aria-invalid')).toBe('false');
  });

  it('un trabajo inexistente muestra "El trabajo no existe"', async () => {
    setup({
      ...editRoute,
      extra: (call) =>
        call.method === 'GET' && call.path === '/api/admin/jobs/5'
          ? errorResponse(404, 'JOB_NOT_FOUND', 'No existe')
          : undefined,
    });

    expect(await screen.findByText('El trabajo no existe')).toBeTruthy();
  });
});
