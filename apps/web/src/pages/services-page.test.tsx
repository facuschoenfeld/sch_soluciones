// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { categoriesFixture, landingService, windowsService } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { ServicesPage } from './services-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Simula la API pública: categorías y servicios (filtra por ?category= como el backend). */
function mockApi({ servicesStatus = 200 } = {}) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/api/public/categories') {
      return Response.json({ data: categoriesFixture });
    }
    if (url.pathname === '/api/public/services') {
      if (servicesStatus !== 200) {
        return Response.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Error' } },
          { status: servicesStatus },
        );
      }
      const category = url.searchParams.get('category');
      const all = [landingService, windowsService];
      return Response.json({
        data: category ? all.filter((s) => s.category.slug === category) : all,
      });
    }
    return Response.json({ error: { code: 'NOT_FOUND', message: 'No' } }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function serviceTitles() {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
}

describe('ServicesPage', () => {
  it('lista los servicios con precio formateado', async () => {
    mockApi();
    renderWithProviders(<ServicesPage />, { route: '/servicios' });

    expect(await screen.findByText('Instalación de Windows')).toBeTruthy();
    expect(serviceTitles()).toEqual(['Landing page', 'Instalación de Windows']);
    // getByText normaliza los espacios: el U+00A0 de Intl se compara como espacio común.
    expect(screen.getByText('$ 30.000 por equipo')).toBeTruthy();
    expect(screen.getByText('Desde $ 150.000')).toBeTruthy();
  });

  it('filtra por línea desde la URL y con los chips', async () => {
    mockApi();
    const user = userEvent.setup();
    const { router } = renderWithProviders(<ServicesPage />, {
      route: '/servicios?linea=desarrollo',
    });

    await screen.findByText('Landing page');
    expect(serviceTitles()).toEqual(['Landing page']);

    await user.click(screen.getByRole('button', { name: 'Servicio técnico' }));
    expect(serviceTitles()).toEqual(['Instalación de Windows']);
    expect(router.state.location.search).toBe('?linea=servicio-tecnico');
    expect(
      screen.getByRole('button', { name: 'Servicio técnico' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('filtra por categoría pidiéndole a la API solo esa categoría', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    renderWithProviders(<ServicesPage />, { route: '/servicios' });

    await user.click(await screen.findByRole('button', { name: 'Desarrollo web' }));

    expect(await screen.findByText('Landing page')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/services?category=desarrollo-web',
      expect.anything(),
    );
  });

  it('muestra el estado vacío y permite limpiar los filtros', async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<ServicesPage />, { route: '/servicios?categoria=sin-servicios' });

    expect(await screen.findByText('No encontré servicios con esos filtros')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ver todos los servicios' }));
    expect(await screen.findByText('Instalación de Windows')).toBeTruthy();
  });

  it('ignora un slug de categoría mal formado en la URL', async () => {
    const fetchMock = mockApi();
    renderWithProviders(<ServicesPage />, { route: '/servicios?categoria=Mal%20Slug!' });

    await screen.findByText('Landing page');
    expect(fetchMock).toHaveBeenCalledWith('/api/public/services', expect.anything());
  });

  it('ignora una categoría que no pertenece a la línea elegida', async () => {
    const fetchMock = mockApi();
    renderWithProviders(<ServicesPage />, {
      route: '/servicios?linea=desarrollo&categoria=reparacion',
    });

    // Cuando cargan las categorías se sabe que "reparacion" es de otra línea y se descarta.
    expect(await screen.findByText('Landing page')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/public/services', expect.anything());
    expect(screen.queryByText('No encontré servicios con esos filtros')).toBeNull();
    const categoryGroup = screen.getByRole('group', { name: 'Categoría' });
    expect(
      within(categoryGroup).getByRole('button', { name: 'Todas' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('recorta una búsqueda de la URL más larga que el límite de la API', async () => {
    const fetchMock = mockApi();
    renderWithProviders(<ServicesPage />, { route: `/servicios?q=${'a'.repeat(150)}` });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/public/services?q=${'a'.repeat(100)}`,
        expect.anything(),
      ),
    );
  });

  it('muestra el error del servidor con opción de reintentar', async () => {
    mockApi({ servicesStatus: 500 });
    renderWithProviders(<ServicesPage />, { route: '/servicios' });

    expect(await screen.findByText('No se pudo cargar la información')).toBeTruthy();
    expect(screen.getByText(/El servidor tuvo un problema/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});
