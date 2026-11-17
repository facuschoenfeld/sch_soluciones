// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  categoriesFixture,
  landingService,
  settingsFixture,
  windowsService,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { HomePage } from './home-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockApi({ settingsOk = true } = {}) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/api/public/settings') {
      return settingsOk
        ? Response.json({ data: settingsFixture })
        : Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Error' } }, { status: 500 });
    }
    if (url.pathname === '/api/public/categories') {
      return Response.json({ data: categoriesFixture });
    }
    if (url.pathname === '/api/public/services') {
      return Response.json({ data: [landingService, windowsService] });
    }
    return Response.json({ error: { code: 'NOT_FOUND', message: 'No' } }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('HomePage', () => {
  it('muestra el hero con el título y subtítulo de la configuración', async () => {
    mockApi();
    renderWithProviders(<HomePage />);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Título' });
    expect(heading).toBeTruthy();
    expect(screen.getByText('Subtítulo')).toBeTruthy();
  });

  it('usa textos de respaldo si la configuración no carga', async () => {
    mockApi({ settingsOk: false });
    renderWithProviders(<HomePage />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Soluciones en desarrollo y servicio técnico',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Páginas web, aplicaciones de escritorio y mantenimiento de PC para tu casa o negocio.',
      ),
    ).toBeTruthy();
  });

  it('en destacados muestra solo los servicios con isFeatured', async () => {
    mockApi();
    renderWithProviders(<HomePage />);

    const section = (await screen.findByRole('heading', { name: 'Servicios destacados' })).closest(
      'section',
    );
    expect(section).not.toBeNull();
    expect(await within(section as HTMLElement).findByText('Instalación de Windows')).toBeTruthy();
    expect(within(section as HTMLElement).queryByText('Landing page')).toBeNull();
  });

  it('muestra el estado vacío si ningún servicio es destacado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const { pathname } = new URL(input, 'http://localhost');
        if (pathname === '/api/public/services') {
          return Response.json({ data: [landingService] });
        }
        return Response.json({ data: pathname.endsWith('categories') ? [] : settingsFixture });
      }),
    );
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Todavía no hay servicios destacados')).toBeTruthy();
  });

  it('las tarjetas de línea enlazan al listado filtrado por línea', async () => {
    mockApi();
    renderWithProviders(<HomePage />);

    const dev = await screen.findByRole('link', { name: 'Desarrollo' });
    expect(dev.getAttribute('href')).toBe('/servicios?linea=desarrollo');
    const tech = screen.getByRole('link', { name: 'Servicio técnico' });
    expect(tech.getAttribute('href')).toBe('/servicios?linea=servicio-tecnico');
  });
});
