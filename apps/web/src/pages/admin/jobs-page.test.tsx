// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { makeClientDetail, makeJob, makeService, paginated } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { JobsPage } from './jobs-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const quoted = makeJob({ id: 1, title: 'Presupuesto de red' });
const done = makeJob({
  id: 2,
  title: 'Cambio de pantalla',
  status: 'COMPLETED',
  amountCharged: 50000,
  amountPaid: 20000,
  client: { id: 2, fullName: 'Beto Gómez', phone: '5491166667777' },
});

const jobCalls = (calls: ApiCall[]) =>
  calls
    .filter((call) => call.method === 'GET' && call.path === '/api/admin/jobs')
    .map((call) => new URLSearchParams(call.search));
const lastJobCall = (calls: ApiCall[]) => jobCalls(calls).at(-1);

function setup({
  route = '/admin/trabajos',
  respond = () => Response.json(paginated([quoted, done])),
}: {
  route?: string;
  respond?: (params: URLSearchParams) => Response;
} = {}) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      if (call.method === 'GET' && call.path === '/api/admin/jobs') {
        return respond(new URLSearchParams(call.search));
      }
      if (call.method === 'GET' && call.path === '/api/admin/services') {
        return Response.json({ data: [makeService({ id: 1, name: 'Limpieza de PC' })] });
      }
      if (call.method === 'GET' && call.path === '/api/admin/clients/2') {
        return Response.json({ data: makeClientDetail({ id: 2, fullName: 'Beto Gómez' }) });
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<JobsPage />, { route });
  return { ...api, ...view, user: userEvent.setup() };
}

const search = (router: { state: { location: { search: string } } }) =>
  new URLSearchParams(router.state.location.search);
const resultText = () => screen.getByRole('status').textContent;

describe('JobsPage (listado)', () => {
  it('lista los trabajos con cliente, estado y cantidad', async () => {
    setup();

    expect(await screen.findByRole('link', { name: 'Presupuesto de red' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cambio de pantalla' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Beto Gómez' }).getAttribute('href')).toBe(
      '/admin/clientes/2',
    );
    expect(resultText()).toBe('2 trabajos');
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
  });

  it('sin filtros pide página 1 y no manda status, balanceDue ni fechas', async () => {
    const { calls } = setup();
    await screen.findByText('Presupuesto de red');

    const params = lastJobCall(calls);
    expect(Object.fromEntries(params ?? [])).toEqual({ page: '1', pageSize: '20' });
  });

  it('muestra el estado vacío si no hay trabajos', async () => {
    setup({ respond: () => Response.json(paginated([])) });

    expect(await screen.findByText('Todavía no registraste trabajos')).toBeTruthy();
  });

  it('muestra el error y "Reintentar" vuelve a pedir', async () => {
    let fail = true;
    const { user } = setup({
      respond: () =>
        fail ? errorResponse(500, 'INTERNAL_ERROR', 'Error') : Response.json(paginated([quoted])),
    });

    expect(await screen.findByText('No se pudieron cargar los trabajos')).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Reintentar/ }));

    expect(await screen.findByText('Presupuesto de red')).toBeTruthy();
  });

  it('pagina: "Siguiente" pone pagina=2 en la URL y pide la página 2', async () => {
    const { user, router, calls } = setup({
      respond: (params) => {
        const page = Number(params.get('page'));
        return Response.json(
          paginated([makeJob({ id: page, title: `Trabajo ${page}` })], {
            page,
            pageSize: 20,
            total: 30,
          }),
        );
      },
    });
    await screen.findByText('Trabajo 1');
    expect(resultText()).toBe('30 trabajos, página 1 de 2');

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));

    expect(search(router).get('pagina')).toBe('2');
    expect(await screen.findByText('Trabajo 2')).toBeTruthy();
    expect(lastJobCall(calls)?.get('page')).toBe('2');
  });
});

describe('JobsPage (filtros)', () => {
  it('elegir un estado lo escribe en la URL (estado) y lo manda a la API (status)', async () => {
    const { user, router, calls } = setup({
      respond: (params) =>
        Response.json(paginated(params.get('status') === 'COMPLETED' ? [done] : [quoted, done])),
    });
    await screen.findByText('Presupuesto de red');

    await user.selectOptions(screen.getByLabelText('Estado'), 'COMPLETED');

    expect(search(router).get('estado')).toBe('COMPLETED');
    await waitFor(() => expect(lastJobCall(calls)?.get('status')).toBe('COMPLETED'));
    await waitFor(() => expect(screen.queryByText('Presupuesto de red')).toBeNull());
    expect(resultText()).toBe('1 trabajo con estos filtros');
  });

  it('el checkbox de saldo escribe saldo=1 y manda balanceDue=true', async () => {
    const { user, router, calls } = setup();
    await screen.findByText('Presupuesto de red');

    await user.click(screen.getByLabelText('Solo terminados con saldo a cobrar'));

    expect(search(router).get('saldo')).toBe('1');
    await waitFor(() => expect(lastJobCall(calls)?.get('balanceDue')).toBe('true'));

    await user.click(screen.getByLabelText('Solo terminados con saldo a cobrar'));
    expect(search(router).has('saldo')).toBe(false);
    // Sin filtros vuelve a la consulta inicial (ya en caché): no hay pedido nuevo.
    await waitFor(() => expect(resultText()).toBe('2 trabajos'));
  });

  it('aplica los filtros que vienen en la URL', async () => {
    const { calls } = setup({
      route: '/admin/trabajos?estado=SCHEDULED&saldo=1&servicio=1&cliente=2',
    });
    await screen.findByText('Presupuesto de red');

    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('SCHEDULED');
    expect(
      (screen.getByLabelText('Solo terminados con saldo a cobrar') as HTMLInputElement).checked,
    ).toBe(true);
    expect(Object.fromEntries(lastJobCall(calls) ?? [])).toMatchObject({
      status: 'SCHEDULED',
      balanceDue: 'true',
      serviceId: '1',
      clientId: '2',
    });
    // El cliente del filtro se muestra por nombre, con opción de quitarlo.
    expect(await screen.findByText('Beto Gómez', { selector: 'span' })).toBeTruthy();
  });

  it('ignora los valores inválidos de la URL', async () => {
    const { calls } = setup({ route: '/admin/trabajos?estado=toString&cliente=abc&pagina=-4' });
    await screen.findByText('Presupuesto de red');

    expect(Object.fromEntries(lastJobCall(calls) ?? [])).toEqual({ page: '1', pageSize: '20' });
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
  });

  it('con filtros aparece "Quitar filtros", que los limpia todos', async () => {
    const { user, router, calls } = setup({
      route: '/admin/trabajos?estado=COMPLETED&saldo=1&desde=2026-11-01&pagina=2',
    });
    await screen.findByText('Presupuesto de red');

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));

    expect(router.state.location.search).toBe('');
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Ingreso desde') as HTMLInputElement).value).toBe('');
    await waitFor(() =>
      expect(Object.fromEntries(lastJobCall(calls) ?? [])).toEqual({ page: '1', pageSize: '20' }),
    );
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
  });

  it('cambiar un filtro vuelve a la primera página', async () => {
    const { user, router } = setup({ route: '/admin/trabajos?pagina=3' });
    await screen.findByText('Presupuesto de red');

    await user.selectOptions(screen.getByLabelText('Estado'), 'QUOTED');

    expect(search(router).has('pagina')).toBe(false);
  });

  it('sin resultados con filtros ofrece "Ver todos" y el texto de estado lo anuncia', async () => {
    const { user, router } = setup({
      route: '/admin/trabajos?estado=CANCELLED',
      respond: (params) => Response.json(paginated(params.get('status') ? [] : [quoted])),
    });

    expect(await screen.findByText('Ningún trabajo coincide con los filtros')).toBeTruthy();
    expect(resultText()).toBe('Ningún trabajo con estos filtros');
    await user.click(screen.getByRole('button', { name: 'Ver todos' }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('Presupuesto de red')).toBeTruthy();
  });

  it('la región de estado cuenta los trabajos "con estos filtros"', async () => {
    setup({ route: '/admin/trabajos?saldo=1' });

    await screen.findByText('Presupuesto de red');
    expect(resultText()).toBe('2 trabajos con estos filtros');
  });
});

describe('JobsPage (fechas)', () => {
  it('un valor parcial (año a medio escribir) no cambia la URL ni busca', async () => {
    const { router, calls } = setup();
    await screen.findByText('Presupuesto de red');
    const before = jobCalls(calls).length;

    fireEvent.change(screen.getByLabelText('Ingreso desde'), { target: { value: '0002-11-23' } });

    expect(router.state.location.search).toBe('');
    expect((screen.getByLabelText('Ingreso desde') as HTMLInputElement).value).toBe('0002-11-23');
    expect(jobCalls(calls)).toHaveLength(before);
  });

  it('un valor completo se aplica a la URL (desde) y a la API (from)', async () => {
    const { router, calls } = setup();
    await screen.findByText('Presupuesto de red');

    fireEvent.change(screen.getByLabelText('Ingreso desde'), { target: { value: '2026-11-10' } });

    expect(search(router).get('desde')).toBe('2026-11-10');
    await waitFor(() => expect(lastJobCall(calls)?.get('from')).toBe('2026-11-10'));
  });

  it('un año fuera de rango (1999) tampoco se aplica', async () => {
    const { router } = setup();
    await screen.findByText('Presupuesto de red');

    fireEvent.change(screen.getByLabelText('Ingreso hasta'), { target: { value: '1999-01-01' } });

    expect(router.state.location.search).toBe('');
  });

  it('borrar la fecha la quita de la URL', async () => {
    const { router } = setup({ route: '/admin/trabajos?desde=2026-11-10' });
    await screen.findByText('Presupuesto de red');

    fireEvent.change(screen.getByLabelText('Ingreso desde'), { target: { value: '' } });

    expect(router.state.location.search).toBe('');
  });

  it('una fecha a medio escribir que se abandona vuelve a la aplicada', async () => {
    setup({ route: '/admin/trabajos?desde=2026-11-10' });
    await screen.findByText('Presupuesto de red');
    const input = screen.getByLabelText('Ingreso desde') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '0002-11-23' } });
    fireEvent.blur(input);

    expect(input.value).toBe('2026-11-10');
  });

  it('"hasta" anterior a "desde": avisa, no la manda a la API y deja lo escrito', async () => {
    const { calls } = setup({ route: '/admin/trabajos?desde=2026-11-10&hasta=2026-11-01' });
    await screen.findByText('Presupuesto de red');

    expect(screen.getByText('Es anterior a "desde": no se tiene en cuenta.')).toBeTruthy();
    expect(screen.getByLabelText('Ingreso hasta').getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByLabelText('Ingreso hasta') as HTMLInputElement).value).toBe('2026-11-01');
    const params = lastJobCall(calls);
    expect(params?.get('from')).toBe('2026-11-10');
    expect(params?.has('to')).toBe(false);
  });

  it('con un rango válido no hay aviso y se mandan ambas fechas', async () => {
    const { calls } = setup({ route: '/admin/trabajos?desde=2026-11-01&hasta=2026-11-10' });
    await screen.findByText('Presupuesto de red');

    expect(screen.queryByText(/no se tiene en cuenta/)).toBeNull();
    expect(lastJobCall(calls)?.get('from')).toBe('2026-11-01');
    expect(lastJobCall(calls)?.get('to')).toBe('2026-11-10');
  });
});

describe('JobsPage (exportación)', () => {
  it('ofrece exportar en PDF y CSV', async () => {
    setup();
    await screen.findByText('Presupuesto de red');

    const group = screen.getByRole('group', { name: /Exportar trabajos/ });
    expect(group.textContent).toContain('PDF');
    expect(group.textContent).toContain('CSV (Excel)');
  });
});
