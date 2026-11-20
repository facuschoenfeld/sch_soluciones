// @vitest-environment jsdom
import type { AdminCategory } from '@sch/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { categoriesList, makeServiceDetail } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { ServiceFormPage } from './service-form-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const callsTo = (calls: ApiCall[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path);

interface SetupOptions {
  route?: string;
  path?: string;
  categories?: AdminCategory[];
  extra?: (call: ApiCall) => Response | undefined;
}

function setup({
  route = '/admin/servicios/nuevo',
  path = '/admin/servicios/nuevo',
  categories = categoriesList,
  extra = () => undefined,
}: SetupOptions = {}) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'GET' && call.path === '/api/admin/categories') {
        return Response.json({ data: categories });
      }
      if (call.method === 'POST' && call.path === '/api/admin/services') {
        return Response.json(
          { data: makeServiceDetail({ id: 20, ...(call.body as object) }) },
          { status: 201 },
        );
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<ServiceFormPage />, { route, path });
  return { ...api, ...view, user: userEvent.setup() };
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nombre'), 'Instalación de Windows');
  await user.type(screen.getByLabelText('Descripción corta'), 'Instalación limpia con drivers.');
}

describe('ServiceFormPage (alta)', () => {
  it('autogenera el slug desde el nombre', async () => {
    const { user } = setup();

    await user.type(await screen.findByLabelText('Nombre'), 'Instalación de Windows 11');

    expect(input('Slug (para el link)').value).toBe('instalacion-de-windows-11');
    expect(
      screen.getByText('Se arma solo a partir del nombre: /servicios/instalacion-de-windows-11'),
    ).toBeTruthy();
  });

  it('deja de autogenerar el slug cuando se edita a mano', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('Nombre'), 'Hola');
    const slug = input('Slug (para el link)');

    await user.clear(slug);
    await user.type(slug, 'mi-slug');
    await user.type(input('Nombre'), ' mundo');

    expect(slug.value).toBe('mi-slug');
  });

  it('crea el servicio: POST /api/admin/services con el body correcto y vuelve al listado', async () => {
    const { user, calls, router } = setup();
    await fillBasics(user);
    await user.type(input('Monto'), '25.000');
    await user.type(input('Unidad (opcional)'), 'por equipo');
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(1));
    expect(callsTo(calls, 'POST', '/api/admin/services')[0]?.body).toMatchObject({
      categoryId: 1,
      name: 'Instalación de Windows',
      slug: 'instalacion-de-windows',
      shortDescription: 'Instalación limpia con drivers.',
      priceType: 'FIXED',
      priceAmount: 25000,
      currency: 'ARS',
      priceUnit: 'por equipo',
      isActive: true,
      isFeatured: false,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/servicios'));
  });

  it('acepta decimales en formato argentino y moneda USD', async () => {
    const { user, calls } = setup();
    await fillBasics(user);
    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD');
    await user.type(input('Monto'), '1.500,50');
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(1));
    expect(callsTo(calls, 'POST', '/api/admin/services')[0]?.body).toMatchObject({
      priceAmount: 1500.5,
      currency: 'USD',
    });
  });

  it('"A consultar" oculta el monto y envía priceAmount null', async () => {
    const { user, calls } = setup();
    await fillBasics(user);
    await user.type(input('Monto'), '25000');

    await user.selectOptions(screen.getByLabelText('Tipo de precio'), 'QUOTE');

    expect(screen.queryByLabelText('Monto')).toBeNull();
    expect(screen.queryByLabelText('Moneda')).toBeNull();
    expect(screen.getByText('A consultar', { selector: 'strong' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(1));
    expect(callsTo(calls, 'POST', '/api/admin/services')[0]?.body).toMatchObject({
      priceType: 'QUOTE',
      priceAmount: null,
    });
  });

  it('al volver de "A consultar" a un precio, recupera el monto escrito', async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.type(input('Monto'), '25000');

    await user.selectOptions(screen.getByLabelText('Tipo de precio'), 'QUOTE');
    await user.selectOptions(screen.getByLabelText('Tipo de precio'), 'FROM');

    expect(input('Monto').value).toBe('25000');
    expect(screen.getByText('Desde $ 25.000', { selector: 'strong', exact: false })).toBeTruthy();
  });

  it('la vista previa del precio se actualiza mientras se escribe', async () => {
    const { user } = setup();
    await screen.findByLabelText('Monto');

    await user.type(input('Monto'), '1500');
    await user.type(input('Unidad (opcional)'), 'por hora');

    expect(screen.getByText(/\$\s1\.500 por hora/, { selector: 'strong' })).toBeTruthy();
  });

  it('un monto inválido muestra el error y no envía', async () => {
    const { user, calls } = setup();
    await fillBasics(user);

    await user.type(input('Monto'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findByText('Ingresá un monto válido')).toBeTruthy();
    expect(input('Monto').getAttribute('aria-invalid')).toBe('true');
    expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(0);
  });

  it('un monto negativo muestra el error y no envía', async () => {
    const { user, calls } = setup();
    await fillBasics(user);

    await user.type(input('Monto'), '-100');
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findByText('El precio no puede ser negativo')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(0);
  });

  it('un precio fijo sin monto exige cargarlo', async () => {
    const { user, calls } = setup();
    await fillBasics(user);

    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findByText('Ingresá el precio (o elegí "A consultar")')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(0);
  });

  it('exige nombre y descripción corta', async () => {
    const { user, calls } = setup();
    await screen.findByLabelText('Nombre');

    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findAllByText('Ingresá el nombre')).toBeTruthy();
    expect(screen.getByText('Ingresá una descripción corta')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/services')).toHaveLength(0);
  });

  it('marca en el campo slug el error 409 SLUG_TAKEN de la API', async () => {
    const message = 'Ya existe un servicio con ese slug';
    const { user } = setup({
      extra: (call) =>
        call.method === 'POST' && call.path === '/api/admin/services'
          ? errorResponse(409, 'SLUG_TAKEN', message, [{ path: ['slug'], message }])
          : undefined,
    });
    await fillBasics(user);
    await user.type(input('Monto'), '25000');
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(input('Slug (para el link)').getAttribute('aria-invalid')).toBe('true');
  });

  it('sin categorías pide crear una primero', async () => {
    setup({ categories: [] });

    expect(await screen.findByText('Primero creá una categoría')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a categorías' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Crear servicio' })).toBeNull();
  });
});

describe('ServiceFormPage (edición)', () => {
  const editRoute = { route: '/admin/servicios/5', path: '/admin/servicios/:id' };
  const detail = makeServiceDetail({
    id: 5,
    name: 'Mantenimiento preventivo',
    slug: 'mantenimiento-preventivo',
    shortDescription: 'Limpieza y revisión.',
    description: 'Detalle del servicio.',
    priceType: 'FROM',
    priceAmount: 1500.5,
    currency: 'USD',
    priceUnit: 'por equipo',
    estimatedTime: '24 h',
    isFeatured: true,
  });
  const withDetail = (call: ApiCall) =>
    call.method === 'GET' && call.path === '/api/admin/services/5'
      ? Response.json({ data: detail })
      : undefined;

  it('carga los datos del servicio en el formulario (GET /api/admin/services/:id)', async () => {
    const { calls } = setup({ ...editRoute, extra: withDetail });

    expect(await screen.findByDisplayValue('Mantenimiento preventivo')).toBeTruthy();
    expect(callsTo(calls, 'GET', '/api/admin/services/5')).toHaveLength(1);
    expect(input('Slug (para el link)').value).toBe('mantenimiento-preventivo');
    expect(input('Descripción corta').value).toBe('Limpieza y revisión.');
    expect((screen.getByLabelText('Tipo de precio') as HTMLSelectElement).value).toBe('FROM');
    expect((screen.getByLabelText('Moneda') as HTMLSelectElement).value).toBe('USD');
    expect(input('Monto').value).toBe('1500,5');
    expect(input('Unidad (opcional)').value).toBe('por equipo');
    expect(input('Tiempo estimado (opcional)').value).toBe('24 h');
    expect(screen.getByRole('heading', { level: 1, name: 'Editar servicio' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver en el sitio/ }).getAttribute('href')).toBe(
      '/servicios/mantenimiento-preventivo',
    );
  });

  it('en edición el slug no sigue al nombre', async () => {
    const { user } = setup({ ...editRoute, extra: withDetail });
    const name = (await screen.findByDisplayValue('Mantenimiento preventivo')) as HTMLInputElement;

    await user.type(name, ' nuevo');

    expect(input('Slug (para el link)').value).toBe('mantenimiento-preventivo');
  });

  it('guarda con PATCH /api/admin/services/:id y vuelve al listado', async () => {
    const { user, calls, router } = setup({
      ...editRoute,
      extra: (call) =>
        withDetail(call) ??
        (call.method === 'PATCH' && call.path === '/api/admin/services/5'
          ? Response.json({ data: detail })
          : undefined),
    });
    await screen.findByDisplayValue('Mantenimiento preventivo');

    await user.clear(input('Monto'));
    await user.type(input('Monto'), '2.000');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(callsTo(calls, 'PATCH', '/api/admin/services/5')).toHaveLength(1));
    expect(callsTo(calls, 'PATCH', '/api/admin/services/5')[0]?.body).toMatchObject({
      name: 'Mantenimiento preventivo',
      priceAmount: 2000,
      currency: 'USD',
      isFeatured: true,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/servicios'));
  });

  it('con 404 muestra "El servicio no existe"', async () => {
    setup({
      ...editRoute,
      extra: (call) =>
        call.path === '/api/admin/services/5'
          ? errorResponse(404, 'NOT_FOUND', 'No existe')
          : undefined,
    });

    expect(await screen.findByText('El servicio no existe')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver servicios' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
  });

  it('con un id que no es numérico muestra "El servicio no existe" sin consultar la API', async () => {
    const { calls } = setup({ route: '/admin/servicios/abc', path: '/admin/servicios/:id' });

    expect(await screen.findByText('El servicio no existe')).toBeTruthy();
    expect(calls.some((c) => c.path.startsWith('/api/admin/services/'))).toBe(false);
  });

  it('con un error de servidor ofrece reintentar', async () => {
    setup({
      ...editRoute,
      extra: (call) =>
        call.path === '/api/admin/services/5'
          ? errorResponse(500, 'INTERNAL_ERROR', 'Error')
          : undefined,
    });

    expect(await screen.findByText('No se pudo cargar el formulario')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('ServiceFormPage (cambios sin guardar)', () => {
  it('pide confirmación al salir con cambios y deja quedarse', async () => {
    const { user, router } = setup();
    await fillBasics(user);

    await user.click(screen.getByRole('link', { name: 'Volver a servicios' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Salir sin guardar?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(router.state.location.pathname).toBe('/admin/servicios/nuevo');
    expect(input('Nombre').value).toBe('Instalación de Windows');
  });

  it('sin cambios sale directo, sin preguntar', async () => {
    const { user, router } = setup();
    await screen.findByLabelText('Nombre');

    await user.click(screen.getByRole('link', { name: 'Volver a servicios' }));

    expect(router.state.location.pathname).toBe('/admin/servicios');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
