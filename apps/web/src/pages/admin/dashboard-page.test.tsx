// @vitest-environment jsdom
import type { AdminDashboard } from '@sch/shared';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi } from '@/test/admin-api';
import { makeDashboard } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './dashboard-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(respond: () => Response) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) =>
      call.method === 'GET' && call.path === '/api/admin/dashboard' ? respond() : undefined,
  });
  const view = renderWithProviders(<DashboardPage />, { route: '/admin' });
  return { ...api, ...view, user: userEvent.setup() };
}

const full: AdminDashboard = makeDashboard({
  statusCounts: {
    QUOTED: 2,
    SCHEDULED: 1,
    IN_PROGRESS: 4,
    COMPLETED: 3,
    DELIVERED: 7,
    CANCELLED: 0,
  },
  monthIncome: [
    { currency: 'ARS', charged: 150000, paid: 100000, jobs: 3 },
    { currency: 'USD', charged: 200, paid: 200, jobs: 1 },
  ],
  balanceDue: {
    jobs: 2,
    byCurrency: [
      { currency: 'ARS', amount: 50000 },
      { currency: 'USD', amount: 25 },
    ],
  },
  upcomingJobs: [
    {
      id: 10,
      title: 'Instalar red',
      status: 'SCHEDULED',
      scheduledAt: '2026-11-25T18:30:00.000Z',
      client: { id: 1, fullName: 'Ana Pérez' },
    },
  ],
  recentClients: [
    { id: 1, fullName: 'Ana Pérez', createdAt: '2026-11-20T15:00:00.000Z' },
    { id: 2, fullName: 'Beto Gómez', createdAt: '2026-11-18T15:00:00.000Z' },
  ],
});

/** Espera a que cargue el resumen y devuelve las consultas acotadas a ese panel. */ const panel =
  async (title: string | RegExp) =>
    within((await screen.findByRole('heading', { name: title })).closest('section') as HTMLElement);
describe('DashboardPage', () => {
  it('muestra los ingresos del mes por moneda, con cobrado y cantidad de trabajos', async () => {
    setup(() => Response.json({ data: full }));

    const income = await panel(/Ingresos de noviembre de 2026/);
    expect(await income.findByText(/\$\s150\.000/)).toBeTruthy();
    expect(income.getByText(/Cobrado \$\s100\.000 · 3 trabajos/)).toBeTruthy();
    // El total en dólares (el "Cobrado ..." también menciona 200, por eso se ancla el texto).
    expect(income.getByText(/^(US\$|USD)\s?200$/)).toBeTruthy();
    expect(income.getByText(/1 trabajo$/)).toBeTruthy();
  });

  it('sin ingresos en el mes lo avisa', async () => {
    setup(() => Response.json({ data: makeDashboard() }));

    expect(await screen.findByText('Todavía no terminaste trabajos este mes.')).toBeTruthy();
  });

  it('muestra el saldo por moneda con un link a los trabajos con saldo', async () => {
    setup(() => Response.json({ data: full }));

    const balance = await panel('Pendiente de cobro');
    expect(await balance.findByText(/\$\s50\.000/)).toBeTruthy();
    expect(balance.getByText(/(US\$|USD)\s?25/)).toBeTruthy();
    expect(balance.getByText('2 trabajos terminados con saldo')).toBeTruthy();
    expect(balance.getByRole('link', { name: /Ver trabajos con saldo/ }).getAttribute('href')).toBe(
      '/admin/trabajos?saldo=1',
    );
  });

  it('con un solo trabajo con saldo usa el singular', async () => {
    setup(() =>
      Response.json({
        data: makeDashboard({
          balanceDue: { jobs: 1, byCurrency: [{ currency: 'ARS', amount: 10 }] },
        }),
      }),
    );

    expect(await screen.findByText('1 trabajo terminado con saldo')).toBeTruthy();
  });

  it('sin saldo no hay link y se avisa', async () => {
    setup(() => Response.json({ data: makeDashboard() }));

    const balance = await panel('Pendiente de cobro');
    expect(await balance.findByText('No hay trabajos terminados sin cobrar.')).toBeTruthy();
    expect(balance.queryByRole('link')).toBeNull();
  });

  it('muestra los conteos por estado, cada uno con un link a ?estado=', async () => {
    setup(() => Response.json({ data: full }));

    const statuses = await panel('Trabajos por estado');
    const links = await statuses.findAllByRole('link');
    const byHref = Object.fromEntries(
      links.map((link) => [link.getAttribute('href'), link.textContent]),
    );
    expect(byHref).toMatchObject({
      '/admin/trabajos?estado=QUOTED': '2Presupuestado',
      '/admin/trabajos?estado=SCHEDULED': '1Agendado',
      '/admin/trabajos?estado=IN_PROGRESS': '4En curso',
      '/admin/trabajos?estado=COMPLETED': '3Terminado',
      '/admin/trabajos?estado=DELIVERED': '7Entregado',
      '/admin/trabajos?estado=CANCELLED': '0Cancelado',
    });
    expect(
      statuses.getByRole('link', { name: 'Ver todos los trabajos' }).getAttribute('href'),
    ).toBe('/admin/trabajos');
  });

  it('sin trabajos el link general dice "Ir a trabajos"', async () => {
    setup(() => Response.json({ data: makeDashboard() }));

    expect(await screen.findByRole('link', { name: 'Ir a trabajos' })).toBeTruthy();
  });

  it('lista los próximos turnos con fecha, cliente y link al trabajo', async () => {
    setup(() => Response.json({ data: full }));

    const upcoming = await panel('Próximos turnos');
    const link = await upcoming.findByRole('link', { name: 'Instalar red' });
    expect(link.getAttribute('href')).toBe('/admin/trabajos/10');
    expect(upcoming.getByText('25/11/2026, 15:30 · Ana Pérez')).toBeTruthy();
  });

  it('sin turnos agendados lo avisa', async () => {
    setup(() => Response.json({ data: makeDashboard() }));

    expect(await screen.findByText(/No hay turnos agendados/)).toBeTruthy();
  });

  it('lista los últimos clientes con link a su ficha y fecha de alta', async () => {
    setup(() => Response.json({ data: full }));

    const recent = await panel('Últimos clientes');
    expect((await recent.findByRole('link', { name: 'Ana Pérez' })).getAttribute('href')).toBe(
      '/admin/clientes/1',
    );
    expect(recent.getByRole('link', { name: 'Beto Gómez' }).getAttribute('href')).toBe(
      '/admin/clientes/2',
    );
    expect(recent.getByText('20/11/2026')).toBeTruthy();
    expect(recent.getByRole('link', { name: /Ver clientes/ }).getAttribute('href')).toBe(
      '/admin/clientes',
    );
  });

  it('sin clientes lo avisa', async () => {
    setup(() => Response.json({ data: makeDashboard() }));

    expect(await screen.findByText('Todavía no cargaste clientes.')).toBeTruthy();
  });

  it('ofrece atajos para crear un cliente y un trabajo', async () => {
    setup(() => Response.json({ data: makeDashboard() }));

    expect((await screen.findByRole('link', { name: 'Nuevo cliente' })).getAttribute('href')).toBe(
      '/admin/clientes/nuevo',
    );
    expect(screen.getByRole('link', { name: 'Nuevo trabajo' }).getAttribute('href')).toBe(
      '/admin/trabajos/nuevo',
    );
  });

  it('con error muestra el aviso y "Reintentar" vuelve a pedir el resumen', async () => {
    let fail = true;
    const { user } = setup(() =>
      fail ? errorResponse(500, 'INTERNAL_ERROR', 'Error') : Response.json({ data: full }),
    );

    expect(await screen.findByText('No se pudo cargar el resumen')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pendiente de cobro' })).toBeNull();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Reintentar/ }));

    expect(await screen.findByRole('heading', { name: 'Pendiente de cobro' })).toBeTruthy();
    expect(screen.queryByText('No se pudo cargar el resumen')).toBeNull();
  });

  it('mientras carga muestra el esqueleto accesible', () => {
    setup(() => Response.json({ data: full }));

    expect(screen.getByRole('status', { name: 'Cargando resumen' })).toBeTruthy();
  });
});
