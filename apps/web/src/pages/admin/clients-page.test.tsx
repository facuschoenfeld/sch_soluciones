// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { makeClient, paginated } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { ClientsPage } from './clients-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ana = makeClient({ id: 1, fullName: 'Ana Pérez', phone: '5491122334455', jobsCount: 1 });
const beto = makeClient({
  id: 2,
  fullName: 'Beto Gómez',
  phone: '5491166667777',
  email: null,
  source: 'REFERRAL',
  jobsCount: 3,
});

const listCalls = (calls: ApiCall[]) =>
  calls
    .filter((call) => call.method === 'GET' && call.path === '/api/admin/clients')
    .map((call) => new URLSearchParams(call.search));

function setup({
  route = '/admin/clientes',
  respond = () => Response.json(paginated([ana, beto])),
}: {
  route?: string;
  respond?: (params: URLSearchParams) => Response;
} = {}) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) =>
      call.method === 'GET' && call.path === '/api/admin/clients'
        ? respond(new URLSearchParams(call.search))
        : undefined,
  });
  const view = renderWithProviders(<ClientsPage />, { route });
  return { ...api, ...view, user: userEvent.setup() };
}

describe('ClientsPage', () => {
  it('lista los clientes con teléfono, email, cantidad de trabajos y origen', async () => {
    setup();

    const link = await screen.findByRole('link', { name: 'Ana Pérez' });
    expect(link.getAttribute('href')).toBe('/admin/clientes/1');
    expect(screen.getByText(/5491122334455/)).toBeTruthy();
    expect(screen.getByText(/ana@example.com/)).toBeTruthy();
    expect(screen.getByText('1 trabajo · WhatsApp')).toBeTruthy();
    expect(screen.getByText('3 trabajos · Recomendación')).toBeTruthy();
    expect(screen.getByRole('status', { name: '' }).textContent).toBe('2 clientes');
  });

  it('pide la primera página con el tamaño de página y sin q', async () => {
    const { calls } = setup();
    await screen.findByText('Ana Pérez');

    const [first] = listCalls(calls);
    expect(first?.get('page')).toBe('1');
    expect(first?.get('pageSize')).toBe('20');
    expect(first?.has('q')).toBe(false);
  });

  it('la búsqueda escribe q en la URL al instante y la API la recibe después del debounce', async () => {
    const { user, router, calls } = setup({
      respond: (params) =>
        Response.json(paginated(params.get('q') === 'beto' ? [beto] : [ana, beto])),
    });
    await screen.findByText('Ana Pérez');

    await user.type(screen.getByLabelText('Buscar'), 'beto');

    expect(router.state.location.search).toBe('?q=beto');
    // Una sola búsqueda con el texto completo (no una por letra).
    await waitFor(() => expect(listCalls(calls).some((p) => p.get('q') === 'beto')).toBe(true));
    expect(listCalls(calls).filter((p) => p.has('q') && p.get('q') !== 'beto')).toHaveLength(0);
    await waitFor(() => expect(screen.queryByText('Ana Pérez')).toBeNull());
    expect(screen.getByText('Beto Gómez')).toBeTruthy();
  });

  it('lee q de la URL, la muestra en el campo y la manda a la API', async () => {
    const { calls } = setup({ route: '/admin/clientes?q=ana' });
    await screen.findByText('Ana Pérez');

    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('ana');
    expect(listCalls(calls)[0]?.get('q')).toBe('ana');
  });

  it('muestra el estado vacío si no hay clientes y no se busca', async () => {
    setup({ respond: () => Response.json(paginated([])) });

    expect(await screen.findByText('Todavía no cargaste clientes')).toBeTruthy();
    const link = screen.getAllByRole('link', { name: /Nuevo cliente/ });
    expect(link.every((l) => l.getAttribute('href') === '/admin/clientes/nuevo')).toBe(true);
  });

  it('sin resultados para la búsqueda ofrece "Ver todos", que limpia q', async () => {
    const { user, router } = setup({
      route: '/admin/clientes?q=zzz',
      respond: (params) => Response.json(paginated(params.get('q') ? [] : [ana, beto])),
    });

    expect(
      await screen.findByText('Probá con parte del nombre, el teléfono (solo números) o el email.'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('status')).getByText('Ningún cliente coincide con la búsqueda'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ver todos' }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
  });

  it('muestra el error si la lista no carga y "Reintentar" vuelve a pedirla', async () => {
    let fail = true;
    const { user } = setup({
      respond: () =>
        fail ? errorResponse(500, 'INTERNAL_ERROR', 'Error') : Response.json(paginated([ana])),
    });

    expect(await screen.findByText('No se pudieron cargar los clientes')).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Reintentar/ }));

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
  });

  describe('paginación', () => {
    const page = (params: URLSearchParams) => {
      const number = Number(params.get('page'));
      const data = number === 2 ? [beto] : [ana];
      return Response.json(paginated(data, { page: number, pageSize: 20, total: 25 }));
    };

    it('en la primera página "Anterior" está deshabilitado (aria-disabled) y "Siguiente" no', async () => {
      setup({ respond: page });
      await screen.findByText('Ana Pérez');

      expect(screen.getByRole('button', { name: /Anterior/ }).getAttribute('aria-disabled')).toBe(
        'true',
      );
      expect(screen.getByRole('button', { name: /Siguiente/ }).getAttribute('aria-disabled')).toBe(
        'false',
      );
      expect(screen.getByRole('status').textContent).toBe('25 clientes, página 1 de 2');
    });

    it('"Siguiente" pide la página 2 y la pone en la URL; "Anterior" vuelve', async () => {
      const { user, router, calls } = setup({ respond: page });
      await screen.findByText('Ana Pérez');

      await user.click(screen.getByRole('button', { name: /Siguiente/ }));

      expect(router.state.location.search).toBe('?pagina=2');
      expect(await screen.findByText('Beto Gómez')).toBeTruthy();
      expect(listCalls(calls).some((p) => p.get('page') === '2')).toBe(true);
      expect(screen.getByRole('button', { name: /Siguiente/ }).getAttribute('aria-disabled')).toBe(
        'true',
      );

      await user.click(screen.getByRole('button', { name: /Anterior/ }));
      expect(router.state.location.search).toBe('');
      expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    });

    it('"Anterior" en la primera página no navega', async () => {
      const { user, router } = setup({ respond: page });
      await screen.findByText('Ana Pérez');

      await user.click(screen.getByRole('button', { name: /Anterior/ }));

      expect(router.state.location.search).toBe('');
    });

    it('buscar vuelve a la primera página', async () => {
      const { user, router } = setup({ route: '/admin/clientes?pagina=2', respond: page });
      await screen.findByText('Beto Gómez');

      await user.type(screen.getByLabelText('Buscar'), 'a');

      expect(new URLSearchParams(router.state.location.search).has('pagina')).toBe(false);
    });
  });
});
