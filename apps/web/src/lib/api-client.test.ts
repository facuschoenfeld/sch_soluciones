import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet } from './api-client';

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiError', () => {
  it('conserva status, code y message', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'No existe');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('No existe');
  });
});

describe('apiGet', () => {
  it('devuelve el JSON y antepone /api a la ruta', async () => {
    const fetchMock = mockFetch(Response.json({ status: 'ok' }));
    await expect(apiGet<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/health');
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it.each([
    ['objeto', { 'X-Test': '1' }],
    ['array', [['X-Test', '1']] as [string, string][]],
    ['instancia de Headers', new Headers({ 'X-Test': '1' })],
  ])('permite sumar headers propios (%s) sin perder Accept', async (_forma, custom) => {
    const fetchMock = mockFetch(Response.json({}));
    await apiGet('/x', { headers: custom });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Test')).toBe('1');
  });

  it('lanza ApiError con el code y message del cuerpo de error de la API', async () => {
    mockFetch(
      Response.json({ error: { code: 'NOT_FOUND', message: 'No existe' } }, { status: 404 }),
    );
    await expect(apiGet('/nada')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      message: 'No existe',
    });
  });

  it('lanza ApiError UNKNOWN si el error no tiene el formato esperado', async () => {
    mockFetch(Response.json({ foo: 'bar' }, { status: 500 }));
    const error = await apiGet('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      code: 'UNKNOWN',
      message: 'No se pudo completar la solicitud',
    });
  });

  it('lanza ApiError UNKNOWN si la respuesta de error no es JSON', async () => {
    mockFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' });
  });

  it('propaga el error de red de fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiGet('/x')).rejects.toThrow('Failed to fetch');
  });
});
