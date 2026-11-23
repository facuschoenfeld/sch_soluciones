// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/admin/toaster';
import { errorResponse } from '@/test/admin-api';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { SESSION_QUERY_KEY } from '@/lib/query-client';
import { ExportButtons } from './export-buttons';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const originalSetPointerCapture = Element.prototype.setPointerCapture;
let downloads: string[];

beforeAll(() => {
  // Sonner captura el puntero al tocar un toast; jsdom no lo implementa.
  Element.prototype.setPointerCapture = () => {};
});
afterAll(() => {
  if (originalSetPointerCapture) {
    Element.prototype.setPointerCapture = originalSetPointerCapture;
  } else {
    Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
  }
});

beforeEach(() => {
  downloads = [];
  URL.createObjectURL = vi.fn(() => 'blob:fake') as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  act(() => toast.dismiss());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

function setup(respond: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => respond());
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, { email: 'admin@example.com' });
  queryClient.setQueryData(['admin', 'clients'], { data: [] });
  queryClient.setQueryData(['public', 'settings'], { data: {} });
  const query = vi.fn((format: string) => `q=ana&format=${format}`);
  const view = renderWithProviders(
    <ExportButtons
      path="/admin/clients/export"
      query={query}
      fileName="clientes"
      label="Exportar clientes"
      itemsLabel="clientes"
    />,
    { queryClient },
  );
  render(<Toaster />);
  return { ...view, fetchMock, query, user: userEvent.setup() };
}

const csvResponse = () =>
  new Response('a;b', {
    headers: { 'Content-Disposition': 'attachment; filename="clientes-2026-11-23.csv"' },
  });

describe('ExportButtons', () => {
  it('ofrece PDF y CSV con nombre accesible que dice qué se exporta', () => {
    setup(csvResponse);

    expect(screen.getByRole('group', { name: 'Exportar clientes' })).toBeTruthy();
    // El texto oculto ("Exportar clientes en") antecede al formato visible.
    expect(screen.getByRole('button', { name: /^Exportar clientes en\s*PDF$/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Exportar clientes en\s*CSV \(Excel\)$/ }),
    ).toBeTruthy();
  });

  it('éxito: pide la ruta con la query del formato, descarga con el nombre de la API y avisa', async () => {
    const { user, fetchMock, query } = setup(csvResponse);

    await user.click(screen.getByRole('button', { name: /CSV/ }));

    expect(await screen.findByText('Se descargó clientes-2026-11-23.csv')).toBeTruthy();
    expect(query).toHaveBeenCalledWith('csv');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/clients/export?q=ana&format=csv');
    expect(downloads).toEqual(['clientes-2026-11-23.csv']);
  });

  it('PDF pide format=pdf', async () => {
    const { user, fetchMock } = setup(
      () =>
        new Response('%PDF', {
          headers: { 'Content-Disposition': 'attachment; filename="clientes-2026-11-23.pdf"' },
        }),
    );

    await user.click(screen.getByRole('button', { name: /PDF/ }));

    expect(await screen.findByText('Se descargó clientes-2026-11-23.pdf')).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/clients/export?q=ana&format=pdf');
  });

  it('sin Content-Disposition usa el nombre base con la extensión del formato', async () => {
    const { user } = setup(() => new Response('x'));

    await user.click(screen.getByRole('button', { name: /CSV/ }));

    expect(await screen.findByText('Se descargó clientes.csv')).toBeTruthy();
  });

  it('error 400: muestra el mensaje de la API como aviso y no descarga', async () => {
    const message = 'Hay más de 5.000 registros: filtrá el listado para exportarlo';
    const { user } = setup(() => errorResponse(400, 'EXPORT_TOO_LARGE', message));

    await user.click(screen.getByRole('button', { name: /PDF/ }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(downloads).toHaveLength(0);
    expect(screen.queryByText(/Se descargó/)).toBeNull();
  });

  it('un error de servidor (5xx) usa el aviso genérico, sin detalles', async () => {
    const { user } = setup(() => errorResponse(500, 'INTERNAL_ERROR', 'detalle interno'));

    await user.click(screen.getByRole('button', { name: /CSV/ }));

    expect(await screen.findByText('No se pudo generar el archivo')).toBeTruthy();
    expect(screen.queryByText('detalle interno')).toBeNull();
  });

  it('un 4xx sin el formato de la API muestra el mensaje genérico de descarga', async () => {
    const { user } = setup(() => new Response('boom', { status: 400 }));

    await user.click(screen.getByRole('button', { name: /CSV/ }));

    expect(await screen.findByText('No se pudo descargar el archivo')).toBeTruthy();
  });

  it('401: limpia la sesión y los datos del panel (no los públicos) sin mostrar error', async () => {
    const { user, queryClient } = setup(() => errorResponse(401, 'UNAUTHORIZED', 'No autorizado'));

    await user.click(screen.getByRole('button', { name: /CSV/ }));

    await waitFor(() => expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull());
    expect(queryClient.getQueryData(['admin', 'clients'])).toBeUndefined();
    expect(queryClient.getQueryData(['public', 'settings'])).toEqual({ data: {} });
    expect(screen.queryByText('No autorizado')).toBeNull();
    expect(downloads).toHaveLength(0);
  });

  it('mientras genera muestra "Generando…" y un segundo clic no pide otra vez', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { user, fetchMock } = setup(async () => {
      await gate;
      return csvResponse();
    });

    await user.click(screen.getByRole('button', { name: /CSV/ }));
    expect(await screen.findByRole('button', { name: /Generando…/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /PDF/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /PDF/ }).getAttribute('aria-disabled')).toBe('true');

    release();

    expect(await screen.findByText('Se descargó clientes-2026-11-23.csv')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Generando…/ })).toBeNull());
  });
});
