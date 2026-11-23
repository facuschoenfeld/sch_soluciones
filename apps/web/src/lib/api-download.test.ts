// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDownload } from './api-client';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clicks: { download: string; href: string }[];

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  clicks = [];
  // jsdom no navega: se registra qué descarga se disparó.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiDownload', () => {
  it('pide /api<ruta> con la cookie y dispara la descarga con el nombre del Content-Disposition', async () => {
    const fetchMock = mockFetch(
      new Response('a;b', {
        headers: { 'Content-Disposition': 'attachment; filename="clientes-2026-11-23.csv"' },
      }),
    );

    const name = await apiDownload('/admin/clients/export?format=csv', 'clientes.csv');

    expect(name).toBe('clientes-2026-11-23.csv');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/clients/export?format=csv');
    expect(init.credentials).toBe('same-origin');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clicks).toEqual([{ download: 'clientes-2026-11-23.csv', href: 'blob:fake-url' }]);
  });

  it('el link temporal no queda en el documento', async () => {
    mockFetch(new Response('x'));

    await apiDownload('/admin/jobs/export?format=pdf', 'trabajos.pdf');

    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('sin Content-Disposition usa el nombre de respaldo', async () => {
    mockFetch(new Response('x'));

    const name = await apiDownload('/admin/jobs/export?format=pdf', 'trabajos.pdf');

    expect(name).toBe('trabajos.pdf');
    expect(clicks[0]?.download).toBe('trabajos.pdf');
  });

  it('libera la URL del blob un rato después (no antes de que el navegador tome el archivo)', async () => {
    vi.useFakeTimers();
    mockFetch(new Response('x'));

    await apiDownload('/admin/jobs/export?format=pdf', 'trabajos.pdf');

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('un error de la API se lanza como ApiError con status, code y mensaje (sin descargar)', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'EXPORT_TOO_LARGE', message: 'Demasiados registros: filtrá el listado' } },
        { status: 400 },
      ),
    );

    const error = await apiDownload('/admin/jobs/export?format=csv', 'trabajos.csv').catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'EXPORT_TOO_LARGE',
      message: 'Demasiados registros: filtrá el listado',
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clicks).toHaveLength(0);
  });

  it('un error sin el formato de la API (ej. HTML de un proxy) usa un mensaje genérico', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await apiDownload('/admin/jobs/export?format=csv', 'trabajos.csv').catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({
      status: 502,
      code: 'UNKNOWN',
      message: 'No se pudo descargar el archivo',
    });
  });

  it('un 401 se lanza como ApiError 401 (para que el panel cierre la sesión)', async () => {
    mockFetch(
      Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 }),
    );

    await expect(apiDownload('/admin/clients/export?format=csv', 'c.csv')).rejects.toMatchObject({
      status: 401,
    });
  });
});
