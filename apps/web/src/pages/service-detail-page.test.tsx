// @vitest-environment jsdom
import type { PublicServiceDetail } from '@sch/shared';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicQueryKeys } from '@/lib/public-api';
import { settingsFixture, windowsService } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { ServiceDetailPage } from './service-detail-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const markdown = [
  'Incluye **backup** de archivos.',
  '',
  '- Drivers actualizados',
  '- Antivirus',
  '',
  '[Guía externa](https://example.com/guia) y [Contacto](/contacto)',
  '',
  '<script>alert(1)</script>',
  '',
  '![logo](https://example.com/logo.png)',
  '',
  '<img src="https://example.com/x.png" alt="crudo">',
].join('\n');

const detail: PublicServiceDetail = { ...windowsService, description: markdown };

function mockFetch(handler: () => Response) {
  const fetchMock = vi.fn(async () => handler());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockDetail(data: PublicServiceDetail = detail) {
  return mockFetch(() => Response.json({ data }));
}

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(publicQueryKeys.settings, settingsFixture);
  return renderWithProviders(<ServiceDetailPage />, {
    route: `/servicios/${windowsService.slug}`,
    path: '/servicios/:slug',
    queryClient,
  });
}

describe('ServiceDetailPage', () => {
  it('muestra nombre, precio formateado y tiempo estimado', async () => {
    const fetchMock = mockDetail();
    setup();

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Instalación de Windows');
    // getByText normaliza el U+00A0 de Intl a espacio común.
    expect(screen.getByText('$ 30.000 por equipo')).toBeTruthy();
    expect(screen.getByText('Tiempo estimado')).toBeTruthy();
    expect(screen.getByText('24 h')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/services/instalacion-de-windows',
      expect.anything(),
    );
  });

  it('renderiza la descripción en markdown con links externos en pestaña nueva', async () => {
    mockDetail();
    setup();

    // El componente Markdown se carga con React.lazy.
    expect(await screen.findByText('backup', undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('backup').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining(['Drivers actualizados', 'Antivirus']),
    );

    const external = screen.getByRole('link', { name: 'Guía externa' });
    expect(external.getAttribute('href')).toBe('https://example.com/guia');
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toContain('noopener');

    const internal = screen.getByRole('link', { name: 'Contacto' });
    expect(internal.getAttribute('target')).toBeNull();
  });

  it('no renderiza HTML crudo ni imágenes del markdown', async () => {
    mockDetail();
    const { container } = setup();

    await screen.findByText('backup', undefined, { timeout: 4000 });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.markdown')?.textContent).not.toContain('alert(1)');
  });

  it('responde "Servicio no encontrado" ante un 404 y enlaza al listado sin reintentar', async () => {
    mockFetch(() =>
      Response.json(
        { error: { code: 'SERVICE_NOT_FOUND', message: 'Servicio no encontrado' } },
        { status: 404 },
      ),
    );
    setup();

    expect(await screen.findByText('Servicio no encontrado')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Ver todos los servicios/ });
    expect(link.getAttribute('href')).toBe('/servicios');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('muestra el error del servidor con opción de reintentar', async () => {
    mockFetch(() =>
      Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Error' } }, { status: 500 }),
    );
    setup();

    expect(await screen.findByText('No se pudo cargar la información')).toBeTruthy();
    expect(screen.getByText(/El servidor tuvo un problema/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.queryByText('Servicio no encontrado')).toBeNull();
  });

  it.each([
    ['Reservar turno', /Reservar turno/],
    ['Hacer una consulta', /Hacer una consulta/],
  ])('el botón "%s" abre el diálogo con esa opción seleccionada', async (buttonName, radioName) => {
    mockDetail();
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: buttonName }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: radioName })).toHaveProperty('checked', true);
    const otherName = buttonName === 'Reservar turno' ? /Hacer una consulta/ : /Reservar turno/;
    expect(within(dialog).getByRole('radio', { name: otherName })).toHaveProperty('checked', false);
  });
});
