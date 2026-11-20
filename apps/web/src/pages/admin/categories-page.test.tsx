// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { categoriesList } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { CategoriesPage } from './categories-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const callsTo = (calls: ApiCall[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path);

function setup(extra: (call: ApiCall) => Response | undefined = () => undefined) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'GET' && call.path === '/api/admin/categories') {
        return Response.json({ data: categoriesList });
      }
      if (call.method === 'POST' && call.path === '/api/admin/categories') {
        return Response.json({ data: { ...categoriesList[0], id: 9 } }, { status: 201 });
      }
      if (call.method === 'PUT' && call.path === '/api/admin/categories/order') {
        return new Response(null, { status: 204 });
      }
      if (call.method === 'DELETE' && call.path.startsWith('/api/admin/categories/')) {
        return new Response(null, { status: 204 });
      }
      return undefined;
    },
  });
  renderWithProviders(<CategoriesPage />, { route: '/admin/categorias' });
  return { ...api, user: userEvent.setup() };
}

describe('CategoriesPage', () => {
  it('lista las categorías con su línea y cantidad de servicios', async () => {
    setup();

    expect(await screen.findByText('Reparación')).toBeTruthy();
    expect(screen.getByText('Desarrollo web')).toBeTruthy();
    expect(screen.getByText(/ 2 servicios/)).toBeTruthy();
    expect(screen.getAllByText(/ 0 servicios/)).toHaveLength(2);
    // La categoría inactiva se marca como oculta.
    expect(screen.getByText('Oculta')).toBeTruthy();
  });

  it('muestra el estado vacío si no hay categorías', async () => {
    setup((call) =>
      call.method === 'GET' && call.path === '/api/admin/categories'
        ? Response.json({ data: [] })
        : undefined,
    );

    expect(await screen.findByText('Todavía no hay categorías')).toBeTruthy();
  });

  it('muestra el error si la lista no carga', async () => {
    setup((call) =>
      call.method === 'GET' && call.path === '/api/admin/categories'
        ? errorResponse(500, 'INTERNAL_ERROR', 'Error')
        : undefined,
    );

    expect(await screen.findByText('No se pudieron cargar las categorías')).toBeTruthy();
  });

  it('crea una categoría con el slug autogenerado desde el nombre', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getAllByRole('button', { name: 'Nueva categoría' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nombre'), 'Cámaras de Seguridad');

    const slug = within(dialog).getByLabelText('Slug (para el link)') as HTMLInputElement;
    expect(slug.value).toBe('camaras-de-seguridad');

    await user.click(within(dialog).getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => expect(callsTo(calls, 'POST', '/api/admin/categories')).toHaveLength(1));
    expect(callsTo(calls, 'POST', '/api/admin/categories')[0]?.body).toEqual({
      name: 'Cámaras de Seguridad',
      slug: 'camaras-de-seguridad',
      description: null,
      icon: null,
      line: 'TECH_SUPPORT',
      isActive: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('si se edita el slug a mano, deja de seguir al nombre', async () => {
    const { user } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getAllByRole('button', { name: 'Nueva categoría' })[0]!);
    const dialog = await screen.findByRole('dialog');
    const slug = within(dialog).getByLabelText('Slug (para el link)') as HTMLInputElement;
    await user.type(within(dialog).getByLabelText('Nombre'), 'Redes');
    await user.clear(slug);
    await user.type(slug, 'mi-slug');
    await user.type(within(dialog).getByLabelText('Nombre'), ' wifi');

    expect(slug.value).toBe('mi-slug');
  });

  it('no envía el alta si falta el nombre', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getAllByRole('button', { name: 'Nueva categoría' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Crear categoría' }));

    expect(await within(dialog).findByText('Ingresá el nombre')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/api/admin/categories')).toHaveLength(0);
  });

  it('marca en el campo slug el error 409 SLUG_TAKEN', async () => {
    const message = 'Ya existe una categoría con ese slug';
    const { user } = setup((call) =>
      call.method === 'POST' && call.path === '/api/admin/categories'
        ? errorResponse(409, 'SLUG_TAKEN', message, [{ path: ['slug'], message }])
        : undefined,
    );
    await screen.findByText('Reparación');

    await user.click(screen.getAllByRole('button', { name: 'Nueva categoría' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nombre'), 'Reparación');
    await user.click(within(dialog).getByRole('button', { name: 'Crear categoría' }));

    expect(await within(dialog).findByText(message)).toBeTruthy();
    expect(within(dialog).getByLabelText('Slug (para el link)').getAttribute('aria-invalid')).toBe(
      'true',
    );
    // El diálogo sigue abierto para corregir.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('sube una categoría: PUT /order con los ids reordenados', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getByRole('button', { name: 'Subir Desarrollo web' }));

    await waitFor(() =>
      expect(callsTo(calls, 'PUT', '/api/admin/categories/order')).toHaveLength(1),
    );
    expect(callsTo(calls, 'PUT', '/api/admin/categories/order')[0]?.body).toEqual({
      ids: [2, 1, 3],
    });
  });

  it('baja una categoría: PUT /order con los ids reordenados', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getByRole('button', { name: 'Bajar Reparación' }));

    await waitFor(() =>
      expect(callsTo(calls, 'PUT', '/api/admin/categories/order')).toHaveLength(1),
    );
    expect(callsTo(calls, 'PUT', '/api/admin/categories/order')[0]?.body).toEqual({
      ids: [2, 1, 3],
    });
  });

  it('deshabilita (sin quitar el foco) subir la primera y bajar la última', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    // aria-disabled en lugar de disabled: el botón sigue enfocable y el clic no hace nada.
    const up = screen.getByRole('button', { name: 'Subir Reparación' });
    const down = screen.getByRole('button', { name: 'Bajar Redes' });
    expect(up.getAttribute('aria-disabled')).toBe('true');
    expect(down.getAttribute('aria-disabled')).toBe('true');
    await user.click(up);
    await user.click(down);
    expect(calls.filter((c) => c.path === '/api/admin/categories/order')).toHaveLength(0);
  });

  it('ofrece borrar solo las categorías sin servicios', async () => {
    setup();
    await screen.findByText('Reparación');

    expect(screen.queryByRole('button', { name: 'Borrar Reparación' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Borrar Desarrollo web' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Borrar Redes' })).toBeTruthy();
  });

  it('pide confirmación y no borra si se cancela', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getByRole('button', { name: 'Borrar Desarrollo web' }));
    expect(await screen.findByText('¿Borrar "Desarrollo web"?')).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByText('¿Borrar "Desarrollo web"?')).toBeNull());
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('al confirmar envía el DELETE de esa categoría', async () => {
    const { user, calls } = setup();
    await screen.findByText('Reparación');

    await user.click(screen.getByRole('button', { name: 'Borrar Desarrollo web' }));
    await screen.findByText('¿Borrar "Desarrollo web"?');
    await user.click(screen.getByRole('button', { name: 'Borrar' }));

    await waitFor(() =>
      expect(callsTo(calls, 'DELETE', '/api/admin/categories/2')).toHaveLength(1),
    );
    await waitFor(() => expect(screen.queryByText('¿Borrar "Desarrollo web"?')).toBeNull());
  });

  it('si el borrado falla, muestra el error dentro del diálogo', async () => {
    const { user } = setup((call) =>
      call.method === 'DELETE'
        ? errorResponse(409, 'CATEGORY_HAS_SERVICES', 'La categoría tiene servicios')
        : undefined,
    );
    await screen.findByText('Reparación');

    await user.click(screen.getByRole('button', { name: 'Borrar Redes' }));
    await screen.findByText('¿Borrar "Redes"?');
    await user.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByText('La categoría tiene servicios')).toBeTruthy();
  });
});
