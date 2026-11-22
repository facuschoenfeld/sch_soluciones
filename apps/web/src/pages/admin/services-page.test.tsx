// @vitest-environment jsdom
import type { AdminServiceSummary } from '@sch/shared';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/admin/toaster';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { categoriesList, makeService, makeServiceDetail } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { ServicesPage } from './services-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const windows = makeService({ id: 1, name: 'Instalación de Windows', priceAmount: 30000 });
const notebook = makeService({
  id: 2,
  name: 'Reparación de notebook',
  slug: 'reparacion-notebook',
  shortDescription: 'Cambio de pantalla',
  priceAmount: 1999,
  sortOrder: 1,
});
const hosting = makeService({
  id: 3,
  categoryId: 2,
  name: 'Alojamiento web',
  slug: 'hosting',
  shortDescription: 'Servidor',
  priceAmount: 10,
  currency: 'USD',
  category: { id: 2, name: 'Desarrollo web', line: 'DEVELOPMENT', isActive: true },
});
const landing = makeService({
  id: 4,
  categoryId: 2,
  name: 'Landing page',
  slug: 'landing',
  shortDescription: 'Una página',
  priceType: 'QUOTE',
  priceAmount: null,
  isActive: false,
  jobsCount: 3,
  category: { id: 2, name: 'Desarrollo web', line: 'DEVELOPMENT', isActive: true },
});
const allServices: AdminServiceSummary[] = [windows, notebook, hosting, landing];

const callsTo = (calls: ApiCall[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path);

function setup({
  route = '/admin/servicios',
  services = allServices,
  extra = () => undefined,
}: {
  route?: string;
  services?: AdminServiceSummary[];
  extra?: (call: ApiCall) => Response | undefined;
} = {}) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'GET' && call.path === '/api/admin/services') {
        return Response.json({ data: services });
      }
      if (call.method === 'GET' && call.path === '/api/admin/categories') {
        return Response.json({ data: categoriesList });
      }
      const patch = /^\/api\/admin\/services\/(\d+)$/.exec(call.path);
      if (call.method === 'PATCH' && patch) {
        const found = services.find((s) => s.id === Number(patch[1]));
        return Response.json({
          data: makeServiceDetail({ ...found, ...(call.body as object) }),
        });
      }
      if (call.method === 'POST' && call.path === '/api/admin/services/bulk-price') {
        return Response.json({ data: { updated: [], skipped: [] } });
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<ServicesPage />, { route });
  return { ...api, ...view, user: userEvent.setup() };
}

const serviceNames = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter((text) => allServices.some((s) => s.name === text));

describe('ServicesPage (listado y filtros)', () => {
  it('lista los servicios con precio y badges de estado', async () => {
    setup();

    expect(await screen.findByText('Instalación de Windows')).toBeTruthy();
    expect(screen.getByText('4 servicios')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Editar precio de Instalación de Windows/ }),
    ).toBeTruthy();
    expect(screen.getByText('Archivado')).toBeTruthy();
    // "A consultar" no se edita en línea.
    expect(screen.queryByRole('button', { name: /Editar precio de Landing page/ })).toBeNull();
  });

  it('muestra el estado vacío si no hay servicios', async () => {
    setup({ services: [] });

    expect(await screen.findByText('Todavía no hay servicios')).toBeTruthy();
  });

  it('muestra el error si la lista no carga', async () => {
    setup({
      extra: (call) =>
        call.method === 'GET' && call.path === '/api/admin/services'
          ? errorResponse(500, 'INTERNAL_ERROR', 'Error')
          : undefined,
    });

    expect(await screen.findByText('No se pudieron cargar los servicios')).toBeTruthy();
  });

  it('aplica los filtros que vienen en la URL', async () => {
    setup({ route: '/admin/servicios?categoria=2&estado=activos' });

    expect(await screen.findByText('Alojamiento web')).toBeTruthy();
    expect(serviceNames()).toEqual(['Alojamiento web']);
    expect(screen.getByText('1 de 4 servicios')).toBeTruthy();
    expect((screen.getByLabelText('Categoría') as HTMLSelectElement).value).toBe('2');
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('activos');
  });

  it('ignora valores inválidos de la URL', async () => {
    setup({ route: '/admin/servicios?categoria=abc&estado=zzz&orden=nada' });

    await screen.findByText('Instalación de Windows');
    expect(screen.getByText('4 servicios')).toBeTruthy();
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('todos');
    expect((screen.getByLabelText('Ordenar por') as HTMLSelectElement).value).toBe('sitio');
  });

  it('escribe la búsqueda y los filtros en la URL y filtra la lista', async () => {
    const { user, router } = setup();
    await screen.findByText('Instalación de Windows');

    await user.type(screen.getByLabelText('Buscar'), 'pantalla');
    expect(router.state.location.search).toBe('?q=pantalla');
    expect(serviceNames()).toEqual(['Reparación de notebook']);

    await user.clear(screen.getByLabelText('Buscar'));
    expect(router.state.location.search).toBe('');

    await user.selectOptions(screen.getByLabelText('Categoría'), '2');
    await user.selectOptions(screen.getByLabelText('Estado'), 'archivados');
    expect(new URLSearchParams(router.state.location.search).get('categoria')).toBe('2');
    expect(new URLSearchParams(router.state.location.search).get('estado')).toBe('archivados');
    expect(serviceNames()).toEqual(['Landing page']);
  });

  it('busca sin importar las tildes', async () => {
    const { user } = setup();
    await screen.findByText('Instalación de Windows');

    await user.type(screen.getByLabelText('Buscar'), 'reparacion');

    expect(serviceNames()).toEqual(['Reparación de notebook']);
  });

  it('ordena por nombre', async () => {
    const { user } = setup();
    await screen.findByText('Instalación de Windows');

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'nombre');

    expect(serviceNames()).toEqual([
      'Alojamiento web',
      'Instalación de Windows',
      'Landing page',
      'Reparación de notebook',
    ]);
  });

  it('sin coincidencias ofrece "Ver todos" para limpiar los filtros', async () => {
    const { user, router } = setup({ route: '/admin/servicios?q=zzzz' });

    expect(await screen.findByText('Ningún servicio coincide con los filtros')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ver todos' }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('Instalación de Windows')).toBeTruthy();
  });

  it('los botones de orden solo aparecen filtrando por categoría', async () => {
    setup({ route: '/admin/servicios?categoria=1' });

    await screen.findByText('Instalación de Windows');
    expect(screen.getByRole('button', { name: 'Bajar Instalación de Windows' })).toBeTruthy();
  });

  it('sin filtrar por categoría no hay botones de orden', async () => {
    setup();

    await screen.findByText('Instalación de Windows');
    expect(screen.queryByRole('button', { name: /^Subir / })).toBeNull();
  });

  it('ofrece borrar solo los servicios sin trabajos registrados', async () => {
    setup();

    await screen.findByText('Instalación de Windows');
    expect(screen.getByRole('button', { name: 'Borrar Instalación de Windows' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Borrar Landing page' })).toBeNull();
  });
});

describe('ServicesPage (archivar y deshacer)', () => {
  /** Con el filtro "activos" (por defecto), la fila archivada desaparece con su componente. */
  function setupWithToaster(
    extra?: (call: ApiCall) => Response | undefined,
    route = '/admin/servicios?estado=activos',
  ) {
    const result = setup({ route, extra });
    render(<Toaster />);
    return result;
  }

  const archiveButton = () =>
    screen.queryByRole('button', { name: 'Archivar Instalación de Windows' });

  // Sonner captura el puntero al tocar un toast; jsdom no lo implementa.
  const originalSetPointerCapture = Element.prototype.setPointerCapture;
  beforeAll(() => {
    Element.prototype.setPointerCapture = () => {};
  });

  afterAll(() => {
    if (originalSetPointerCapture) {
      Element.prototype.setPointerCapture = originalSetPointerCapture;
    } else {
      Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
    }
  });

  afterEach(() => {
    act(() => toast.dismiss());
  });

  it('"Deshacer" restaura el servicio aunque la fila ya no esté', async () => {
    const { user, calls } = setupWithToaster();
    await user.click(
      await screen.findByRole('button', { name: 'Archivar Instalación de Windows' }),
    );
    await waitFor(() => expect(archiveButton()).toBeNull());
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/services/1')).toHaveLength(2));
    expect(callsTo(calls, 'PATCH', '/api/admin/services/1')[1]?.body).toEqual({ isActive: true });
  });

  it('si "Deshacer" falla con la fila ya desmontada, avisa el error', async () => {
    let patches = 0;
    const { user } = setupWithToaster((call) =>
      call.method === 'PATCH' && ++patches === 2
        ? errorResponse(409, 'CONFLICT', 'No se pudo restaurar')
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Archivar Instalación de Windows' }),
    );
    await waitFor(() => expect(archiveButton()).toBeNull());
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));

    expect(await screen.findByText('No se pudo restaurar')).toBeTruthy();
  });

  it('si "Destacar" falla después de tocar "Deshacer" en la misma fila, avisa el error', async () => {
    const isFeaturedPatch = (init?: RequestInit) =>
      init?.method === 'PATCH' && String(init.body).includes('isFeatured');
    const { user, fetchMock } = setupWithToaster(
      (call) =>
        call.method === 'PATCH' && 'isFeatured' in (call.body as object)
          ? errorResponse(409, 'CONFLICT', 'No se pudo destacar')
          : undefined,
      '/admin/servicios?estado=todos',
    );
    // "Destacar" queda guardando hasta que se suelte: mientras, se toca "Deshacer".
    let releaseFeatured = () => {};
    const featuredGate = new Promise<void>((resolve) => {
      releaseFeatured = resolve;
    });
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      if (isFeaturedPatch(init)) await featuredGate;
      return fetchMock(input, init);
    });

    await user.click(
      await screen.findByRole('button', { name: 'Archivar Instalación de Windows' }),
    );
    const undo = await screen.findByRole('button', { name: 'Deshacer' });
    await user.click(screen.getByRole('button', { name: 'Destacar Instalación de Windows' }));
    await user.click(undo);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Archivar Instalación de Windows' })).toBeTruthy(),
    );
    releaseFeatured();

    expect(await screen.findByText('No se pudo destacar')).toBeTruthy();
  });
});

describe('ServicesPage (edición de precio en línea)', () => {
  const openEditor = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(
      await screen.findByRole('button', { name: new RegExp(`Editar precio de ${name}`) }),
    );
    return screen.getByLabelText(`Precio de ${name} en ARS`) as HTMLInputElement;
  };

  it('Enter guarda: PATCH con priceAmount numérico', async () => {
    const { user, calls } = setup();
    const input = await openEditor(user, 'Instalación de Windows');
    expect(input.value).toBe('30000');

    await user.clear(input);
    await user.type(input, '35.000{Enter}');

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/services/1')).toHaveLength(1));
    expect(callsTo(calls, 'PATCH', '/api/admin/services/1')[0]?.body).toEqual({
      priceAmount: 35000,
    });
    // Vuelve al modo lectura.
    await waitFor(() => expect(screen.queryByLabelText(/Precio de Instalación/)).toBeNull());
  });

  it('el botón Guardar precio también envía el cambio, con decimales en formato argentino', async () => {
    const { user, calls } = setup();
    const input = await openEditor(user, 'Instalación de Windows');

    await user.clear(input);
    await user.type(input, '1.500,50');
    await user.click(screen.getByRole('button', { name: 'Guardar precio' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/services/1')).toHaveLength(1));
    expect(callsTo(calls, 'PATCH', '/api/admin/services/1')[0]?.body).toEqual({
      priceAmount: 1500.5,
    });
  });

  it('Escape cancela sin enviar nada', async () => {
    const { user, calls } = setup();
    const input = await openEditor(user, 'Instalación de Windows');

    await user.clear(input);
    await user.type(input, '99999{Escape}');

    await waitFor(() => expect(screen.queryByLabelText(/Precio de Instalación/)).toBeNull());
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect(
      screen.getByRole('button', { name: /Editar precio de Instalación de Windows/ }),
    ).toBeTruthy();
  });

  it('si el monto no cambió, cierra sin enviar', async () => {
    const { user, calls } = setup();
    await openEditor(user, 'Instalación de Windows');

    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByLabelText(/Precio de Instalación/)).toBeNull());
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('rechaza un monto inválido y deja el editor abierto', async () => {
    const { user, calls } = setup();
    const input = await openEditor(user, 'Instalación de Windows');

    await user.clear(input);
    await user.type(input, 'abc{Enter}');

    expect((await screen.findByRole('alert')).textContent).toBe('Ingresá un monto válido');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('rechaza un monto negativo', async () => {
    const { user, calls } = setup();
    const input = await openEditor(user, 'Instalación de Windows');

    await user.clear(input);
    await user.type(input, '-1.000{Enter}');

    expect((await screen.findByRole('alert')).textContent).toBe('El precio no puede ser negativo');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('un monto vacío es inválido (no se manda null)', async () => {
    const { user, calls } = setup();
    const input = await openEditor(user, 'Instalación de Windows');

    await user.clear(input);
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('si la API rechaza el cambio, muestra el error en el editor', async () => {
    const { user } = setup({
      extra: (call) =>
        call.method === 'PATCH'
          ? errorResponse(400, 'VALIDATION_ERROR', 'Precio rechazado')
          : undefined,
    });
    const input = await openEditor(user, 'Instalación de Windows');

    await user.clear(input);
    await user.type(input, '40000{Enter}');

    expect((await screen.findByRole('alert')).textContent).toBe('Precio rechazado');
    expect(screen.getByLabelText(/Precio de Instalación/)).toBeTruthy();
  });
});

describe('ServicesPage (actualización masiva de precios)', () => {
  const selectService = (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.click(screen.getByRole('checkbox', { name: `Seleccionar ${name}` }));

  const bulkCalls = (calls: ApiCall[]) => callsTo(calls, 'POST', '/api/admin/services/bulk-price');

  async function openBulk(user: ReturnType<typeof userEvent.setup>, names: string[]) {
    await screen.findByText('Instalación de Windows');
    for (const name of names) await selectService(user, name);
    await user.click(screen.getByRole('button', { name: 'Actualizar precios' }));
    return screen.findByRole('dialog');
  }

  it('la barra de acciones aparece al seleccionar y se puede quitar la selección', async () => {
    const { user } = setup();
    await screen.findByText('Instalación de Windows');
    expect(screen.queryByRole('region', { name: 'Acciones con la selección' })).toBeNull();

    await selectService(user, 'Instalación de Windows');
    expect(screen.getByText('1 seleccionado')).toBeTruthy();
    await selectService(user, 'Alojamiento web');
    expect(screen.getByText('2 seleccionados')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Quitar selección' }));
    expect(screen.queryByRole('region', { name: 'Acciones con la selección' })).toBeNull();
  });

  it('"Seleccionar todos" marca todos los visibles', async () => {
    const { user } = setup();
    await screen.findByText('Instalación de Windows');

    await user.click(screen.getByLabelText('Seleccionar todos (4)'));

    expect(screen.getByText('4 seleccionados')).toBeTruthy();
  });

  it('muestra antes y después, con los precios nuevos redondeados al entero', async () => {
    const { user } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows', 'Reparación de notebook']);

    await user.type(within(dialog).getByLabelText('Porcentaje'), '10');

    const windowsRow = within(dialog).getByRole('row', { name: /Instalación de Windows/ });
    expect(windowsRow.textContent).toMatch(/30\.000/);
    expect(windowsRow.textContent).toMatch(/33\.000/);
    // 1.999 + 10 % = 2.198,9 → 2.199
    const notebookRow = within(dialog).getByRole('row', { name: /Reparación de notebook/ });
    expect(notebookRow.textContent).toMatch(/1\.999/);
    expect(notebookRow.textContent).toMatch(/2\.199/);
    expect(notebookRow.textContent).not.toMatch(/2\.198/);
    expect(within(dialog).getByRole('button', { name: 'Aplicar a 2 servicios' })).toBeTruthy();
  });

  it('envía POST /bulk-price con los ids y el ajuste', async () => {
    const { user, calls } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows', 'Reparación de notebook']);

    await user.type(within(dialog).getByLabelText('Porcentaje'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar a 2 servicios' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(1));
    expect(bulkCalls(calls)[0]?.body).toEqual({
      serviceIds: [1, 2],
      adjustment: { kind: 'PERCENT', value: 10 },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // La selección se limpia después de aplicar.
    expect(screen.queryByRole('region', { name: 'Acciones con la selección' })).toBeNull();
  });

  it('acepta monto fijo negativo en formato argentino', async () => {
    const { user, calls } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows']);

    await user.click(within(dialog).getByRole('radio', { name: 'Monto fijo ($)' }));
    await user.type(within(dialog).getByLabelText('Monto'), '-1.000');
    expect(within(dialog).getByRole('row', { name: /Instalación de Windows/ }).textContent).toMatch(
      /29\.000/,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar a 1 servicio' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(1));
    expect(bulkCalls(calls)[0]?.body).toEqual({
      serviceIds: [1],
      adjustment: { kind: 'AMOUNT', value: -1000 },
    });
  });

  it('bloquea el monto fijo con monedas mezcladas', async () => {
    const { user, calls } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows', 'Alojamiento web']);

    await user.click(within(dialog).getByRole('radio', { name: 'Monto fijo ($)' }));
    await user.type(within(dialog).getByLabelText('Monto'), '500');

    expect((await within(dialog).findByRole('status')).textContent).toMatch(
      /Hay servicios en pesos y en dólares/,
    );
    const apply = within(dialog).getByRole('button', {
      name: 'Aplicar a 2 servicios',
    }) as HTMLButtonElement;
    expect(apply.getAttribute('aria-disabled')).toBe('true');
    expect(bulkCalls(calls)).toHaveLength(0);
  });

  it('con monedas mezcladas el porcentaje sí se puede aplicar', async () => {
    const { user, calls } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows', 'Alojamiento web']);

    await user.type(within(dialog).getByLabelText('Porcentaje'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar a 2 servicios' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(1));
  });

  it('no deja aplicar un ajuste que dejaría un precio negativo', async () => {
    const { user, calls } = setup();
    const dialog = await openBulk(user, ['Alojamiento web']);

    // El servicio está en dólares: la opción muestra su moneda.
    await user.click(within(dialog).getByRole('radio', { name: 'Monto fijo (US$)' }));
    await user.type(within(dialog).getByLabelText('Monto'), '-500');

    expect((await within(dialog).findByRole('status')).textContent).toMatch(/negativo/);
    expect(
      within(dialog)
        .getByRole('button', { name: 'Aplicar a 1 servicio' })
        .getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    expect(bulkCalls(calls)).toHaveLength(0);
  });

  it('un ajuste de 0 es inválido y deshabilita aplicar', async () => {
    const { user } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows']);

    await user.type(within(dialog).getByLabelText('Porcentaje'), '0');

    expect(await within(dialog).findByText('El ajuste no puede ser 0')).toBeTruthy();
    expect(
      within(dialog)
        .getByRole('button', { name: 'Aplicar a 1 servicio' })
        .getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('sin ingresar el ajuste no se puede aplicar', async () => {
    const { user } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows']);

    expect(
      within(dialog)
        .getByRole('button', { name: 'Aplicar a 1 servicio' })
        .getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('los servicios "a consultar" se listan como no modificables', async () => {
    const { user } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows', 'Landing page']);

    expect(within(dialog).getByText(/No cambian \(son "a consultar"\): Landing page/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Aplicar a 1 servicio' })).toBeTruthy();
  });

  it('cancelar cierra el diálogo sin enviar nada', async () => {
    const { user, calls } = setup();
    const dialog = await openBulk(user, ['Instalación de Windows']);

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(bulkCalls(calls)).toHaveLength(0);
  });

  it('si la API falla muestra el error dentro del diálogo y lo deja abierto', async () => {
    const { user } = setup({
      extra: (call) =>
        call.path === '/api/admin/services/bulk-price'
          ? errorResponse(400, 'VALIDATION_ERROR', 'Ajuste rechazado')
          : undefined,
    });
    const dialog = await openBulk(user, ['Instalación de Windows']);

    await user.type(within(dialog).getByLabelText('Porcentaje'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar a 1 servicio' }));

    expect(await within(dialog).findByText('Ajuste rechazado')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
