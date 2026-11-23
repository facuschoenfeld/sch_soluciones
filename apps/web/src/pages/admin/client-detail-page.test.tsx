// @vitest-environment jsdom
import type { AdminClientDetail, AdminJob } from '@sch/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { makeClientDetail, makeJob, paginated } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { ClientDetailPage } from './client-detail-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface SetupOptions {
  route?: string;
  client?: AdminClientDetail;
  clientResponse?: Response;
  jobs?: AdminJob[];
  jobsResponse?: Response;
  extra?: (call: ApiCall) => Response | undefined;
}

function setup({
  route = '/admin/clientes/1',
  client = makeClientDetail(),
  clientResponse,
  jobs = [],
  jobsResponse,
  extra = () => undefined,
}: SetupOptions = {}) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'GET' && call.path === '/api/admin/clients/1') {
        return clientResponse ?? Response.json({ data: client });
      }
      if (call.method === 'GET' && call.path === '/api/admin/jobs') {
        return jobsResponse ?? Response.json(paginated(jobs, { pageSize: 10 }));
      }
      if (call.method === 'DELETE' && call.path === '/api/admin/clients/1') {
        return new Response(null, { status: 204 });
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<ClientDetailPage />, { route, path: '/admin/clientes/:id' });
  return { ...api, ...view, user: userEvent.setup() };
}

describe('ClientDetailPage (datos)', () => {
  it('muestra nombre, contacto, origen y notas', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeTruthy();
    expect(screen.getByText('Cliente desde el 01/11/2026')).toBeTruthy();
    expect(screen.getByText('5491122334455')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ana@example.com' }).getAttribute('href')).toBe(
      'mailto:ana@example.com',
    );
    expect(screen.getByText('Calle 123')).toBeTruthy();
    expect(screen.getByText('WhatsApp')).toBeTruthy();
    expect(screen.getByText('Prefiere la mañana.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe(
      '/admin/clientes/1/editar',
    );
  });

  it('sin email, dirección ni notas muestra guiones y no hay tarjeta de notas', async () => {
    setup({ client: makeClientDetail({ email: null, address: null, notes: null }) });

    await screen.findByRole('heading', { name: 'Ana Pérez' });
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'Notas' })).toBeNull();
  });

  it('con número con código de país: botón de WhatsApp (nueva pestaña) y tel: con "+"', async () => {
    setup();

    const whatsapp = await screen.findByRole('link', { name: /Escribir por WhatsApp/ });
    const href = whatsapp.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/5491122334455?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('¡Hola, Ana! ');
    expect(whatsapp.getAttribute('target')).toBe('_blank');
    expect(whatsapp.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: '5491122334455' }).getAttribute('href')).toBe(
      'tel:+5491122334455',
    );
    expect(screen.queryByText(/Sin código de país/)).toBeNull();
  });

  it('sin código de país: no hay botón de WhatsApp, el tel: va sin "+" y se avisa', async () => {
    setup({ client: makeClientDetail({ phone: '1122334455' }) });

    await screen.findByRole('heading', { name: 'Ana Pérez' });
    expect(screen.queryByRole('link', { name: /Escribir por WhatsApp/ })).toBeNull();
    expect(screen.getByRole('link', { name: '1122334455' }).getAttribute('href')).toBe(
      'tel:1122334455',
    );
    expect(screen.getByText(/Sin código de país: editalo/)).toBeTruthy();
  });

  it('un número armado mal (54 sin 9) tampoco ofrece WhatsApp', async () => {
    setup({ client: makeClientDetail({ phone: '541122334455' }) });

    await screen.findByRole('heading', { name: 'Ana Pérez' });
    expect(screen.queryByRole('link', { name: /Escribir por WhatsApp/ })).toBeNull();
    expect(screen.getByRole('link', { name: '541122334455' }).getAttribute('href')).toBe(
      'tel:541122334455',
    );
  });
});

describe('ClientDetailPage (facturación)', () => {
  it('sin trabajos terminados lo avisa', async () => {
    setup();

    expect(await screen.findByText('Todavía no tiene trabajos terminados.')).toBeTruthy();
  });

  it('muestra lo facturado y cobrado por moneda, con "Saldo a cobrar" si falta cobrar', async () => {
    setup({
      client: makeClientDetail({
        totals: [
          { currency: 'ARS', charged: 50000, paid: 30000 },
          { currency: 'USD', charged: 100, paid: 100 },
        ],
      }),
    });

    expect(await screen.findByText(/\$\s50\.000/)).toBeTruthy();
    expect(screen.getByText(/Facturado · cobrado \$\s30\.000/)).toBeTruthy();
    expect(screen.getByText(/Saldo a cobrar: \$\s20\.000/)).toBeTruthy();
    // El dólar está saldado: sin saldo.
    expect(screen.getByText(/Facturado · cobrado (US\$|USD)\s?100/)).toBeTruthy();
    expect(screen.getAllByText(/Saldo a cobrar/)).toHaveLength(1);
  });

  it('aclara que solo cuentan los trabajos terminados o entregados', async () => {
    setup();

    expect(await screen.findByText(/Solo trabajos terminados o entregados/)).toBeTruthy();
  });
});

describe('ClientDetailPage (historial)', () => {
  it('pide los trabajos del cliente (clientId, página y tamaño) y los lista', async () => {
    const { calls } = setup({
      client: makeClientDetail({ jobsCount: 2 }),
      jobs: [
        makeJob({ id: 10, title: 'Reparar notebook' }),
        makeJob({ id: 11, title: 'Instalar Windows', status: 'COMPLETED' }),
      ],
    });

    expect(await screen.findByRole('link', { name: 'Reparar notebook' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Instalar Windows' }).getAttribute('href')).toBe(
      '/admin/trabajos/11',
    );
    const jobsCall = calls.find((c) => c.method === 'GET' && c.path === '/api/admin/jobs');
    const params = new URLSearchParams(jobsCall?.search);
    expect(params.get('clientId')).toBe('1');
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('10');
    // En la ficha no se repite el nombre del cliente en cada fila.
    expect(screen.queryByRole('link', { name: 'Ana Pérez' })).toBeNull();
  });

  it('con trabajos ofrece "Filtrar en Trabajos" y "Nuevo trabajo" con el cliente precargado', async () => {
    setup({ client: makeClientDetail({ jobsCount: 1 }), jobs: [makeJob()] });

    expect(
      (await screen.findByRole('link', { name: /Filtrar en Trabajos/ })).getAttribute('href'),
    ).toBe('/admin/trabajos?cliente=1');
    expect(screen.getByRole('link', { name: /Nuevo trabajo/ }).getAttribute('href')).toBe(
      '/admin/trabajos/nuevo?cliente=1',
    );
  });

  it('sin trabajos muestra el estado vacío', async () => {
    setup();

    expect(await screen.findByText('Todavía no tiene trabajos')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Filtrar en Trabajos/ })).toBeNull();
  });

  it('si el historial no carga, avisa y la ficha sigue visible', async () => {
    setup({ jobsResponse: errorResponse(500, 'INTERNAL_ERROR', 'Error') });

    expect(await screen.findByText('No se pudo cargar el historial')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ana Pérez' })).toBeTruthy();
  });

  it('pagina el historial con "Siguiente"', async () => {
    const { user, calls } = setup({
      client: makeClientDetail({ jobsCount: 12 }),
      extra: (call) => {
        if (call.method !== 'GET' || call.path !== '/api/admin/jobs') return undefined;
        const page = Number(new URLSearchParams(call.search).get('page'));
        return Response.json(
          paginated([makeJob({ id: page, title: `Trabajo página ${page}` })], {
            page,
            pageSize: 10,
            total: 12,
          }),
        );
      },
    });
    await screen.findByText('Trabajo página 1');

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));

    expect(await screen.findByText('Trabajo página 2')).toBeTruthy();
    expect(
      calls.some(
        (c) => c.path === '/api/admin/jobs' && new URLSearchParams(c.search).get('page') === '2',
      ),
    ).toBe(true);
  });
});

describe('ClientDetailPage (borrar)', () => {
  it('sin trabajos permite borrar: confirma, hace DELETE y vuelve al listado', async () => {
    const { user, calls, router } = setup();
    await user.click(await screen.findByRole('button', { name: 'Borrar cliente' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('¿Borrar a Ana Pérez?')).toBeTruthy();
    // Todavía no se borró nada.
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Borrar cliente' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clientes'));
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual([
      '/api/admin/clients/1',
    ]);
  });

  it('cancelar la confirmación no borra', async () => {
    const { user, calls, router } = setup();
    await user.click(await screen.findByRole('button', { name: 'Borrar cliente' }));

    await user.click(within(await screen.findByRole('alertdialog')).getByText('Cancelar'));

    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/admin/clientes/1');
  });

  it('si la API rechaza el borrado, muestra el error dentro del diálogo y no navega', async () => {
    const { user, router } = setup({
      extra: (call) =>
        call.method === 'DELETE'
          ? errorResponse(409, 'CLIENT_HAS_JOBS', 'El cliente tiene trabajos registrados')
          : undefined,
    });
    await user.click(await screen.findByRole('button', { name: 'Borrar cliente' }));
    const dialog = await screen.findByRole('alertdialog');

    await user.click(within(dialog).getByRole('button', { name: 'Borrar cliente' }));

    expect(await within(dialog).findByText('El cliente tiene trabajos registrados')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/admin/clientes/1');
  });

  it('con trabajos no hay botón de borrar y se explica por qué', async () => {
    setup({ client: makeClientDetail({ jobsCount: 2 }), jobs: [makeJob()] });

    await screen.findByRole('heading', { name: 'Ana Pérez' });
    expect(screen.queryByRole('button', { name: 'Borrar cliente' })).toBeNull();
    expect(screen.getByText(/no se puede borrar/)).toBeTruthy();
  });
});

describe('ClientDetailPage (errores)', () => {
  it('404 muestra "El cliente no existe"', async () => {
    setup({ clientResponse: errorResponse(404, 'CLIENT_NOT_FOUND', 'El cliente no existe') });

    expect(await screen.findByText('El cliente no existe')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver clientes' }).getAttribute('href')).toBe(
      '/admin/clientes',
    );
  });

  it('un id que no es número muestra "El cliente no existe" sin pedir nada', async () => {
    const { calls } = setup({ route: '/admin/clientes/abc' });

    expect(await screen.findByText('El cliente no existe')).toBeTruthy();
    expect(calls.filter((c) => c.path.startsWith('/api/admin/clients'))).toHaveLength(0);
  });

  it('un error de servidor ofrece reintentar', async () => {
    let fail = true;
    const { user } = setup({
      extra: (call) =>
        fail && call.method === 'GET' && call.path === '/api/admin/clients/1'
          ? errorResponse(500, 'INTERNAL_ERROR', 'Error')
          : undefined,
    });

    expect(await screen.findByText('No se pudo cargar el cliente')).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Reintentar/ }));

    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeTruthy();
  });
});
