import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiSend, fieldErrors } from './api-client';

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

describe('apiSend', () => {
  it('manda method, Content-Type JSON, body serializado y credentials same-origin', async () => {
    const fetchMock = mockFetch(Response.json({ data: { id: 1 } }));
    await expect(apiSend('POST', '/things', { name: 'a', n: 2 })).resolves.toEqual({
      data: { id: 1 },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/things');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBe(JSON.stringify({ name: 'a', n: 2 }));
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it.each(['PUT', 'PATCH', 'DELETE'] as const)('usa el método %s', async (method) => {
    const fetchMock = mockFetch(Response.json({}));
    await apiSend(method, '/x', {});
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe(method);
  });

  it('sin body deja el body undefined pero mantiene el Content-Type', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    await apiSend('POST', '/auth/logout');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('un 204 devuelve null', async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(apiSend('POST', '/auth/logout')).resolves.toBeNull();
  });

  it('un error con details los deja en ApiError.details', async () => {
    const details = [{ path: ['currentPassword'], message: 'Incorrecta' }];
    mockFetch(
      Response.json(
        { error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Mal', details } },
        { status: 400 },
      ),
    );
    const error = await apiSend('POST', '/admin/password', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toEqual(details);
    expect((error as ApiError).code).toBe('INVALID_CURRENT_PASSWORD');
  });
});

describe('fieldErrors', () => {
  it('mapea details [{ path, message }] por campo', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'x', [
      { path: ['email'], message: 'Email inválido' },
      { path: ['password'], message: 'Muy corta' },
    ]);
    expect(fieldErrors(error)).toEqual({ email: 'Email inválido', password: 'Muy corta' });
  });

  it('se queda con el primer mensaje de cada campo', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'x', [
      { path: ['email'], message: 'Primero' },
      { path: ['email'], message: 'Segundo' },
    ]);
    expect(fieldErrors(error)).toEqual({ email: 'Primero' });
  });

  it('ignora items con formato raro', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'x', [
      null,
      'texto',
      42,
      { path: 'email', message: 'path no es array' },
      { path: [], message: 'path vacío' },
      { path: [0], message: 'path numérico' },
      { path: ['a'], message: 123 },
      { path: ['b'] },
      { path: ['ok', 'anidado'], message: 'Bien' },
    ]);
    expect(fieldErrors(error)).toEqual({ ok: 'Bien' });
  });

  it('devuelve {} si no es ApiError o details no es un array', () => {
    expect(fieldErrors(new Error('x'))).toEqual({});
    expect(fieldErrors(undefined)).toEqual({});
    expect(fieldErrors(new ApiError(400, 'X', 'x'))).toEqual({});
    expect(fieldErrors(new ApiError(400, 'X', 'x', { path: ['a'], message: 'm' }))).toEqual({});
  });
});
