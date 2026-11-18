import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { DbPinger } from '../src/lib/prisma.js';
import { DB_HEALTH_CACHE_MS, createDbHealthChecker } from '../src/modules/health/health.service.js';
import { createTestApp } from './helpers/test-app.js';

function fakeDb(queryRaw: ReturnType<typeof vi.fn>): DbPinger {
  return { $queryRaw: queryRaw } as unknown as DbPinger;
}

function buildApp(queryRaw: ReturnType<typeof vi.fn> = vi.fn()) {
  // Los health checks solo usan $queryRaw: alcanza con un cliente falso.
  const db = fakeDb(queryRaw) as unknown as PrismaClient;
  return createTestApp(db);
}

describe('GET /api/health', () => {
  it('responde 200 sin consultar la base', async () => {
    const queryRaw = vi.fn();
    const res = await request(buildApp(queryRaw)).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe('GET /api/health/db', () => {
  it('responde 200 cuando la base responde', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(buildApp(queryRaw)).get('/api/health/db');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('responde 503 con formato uniforme y sin filtrar el error interno', async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error('connection refused'));
    const res = await request(buildApp(queryRaw)).get('/api/health/db');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'La base de datos no está disponible' },
    });
    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });

  it('reutiliza el último ping exitoso para no despertar la base en cada request', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const app = buildApp(queryRaw);

    await request(app).get('/api/health/db');
    await request(app).get('/api/health/db');

    expect(queryRaw).toHaveBeenCalledOnce();
  });
});

describe('createDbHealthChecker', () => {
  it('vuelve a consultar la base cuando vence la caché', async () => {
    let currentTime = 0;
    const queryRaw = vi.fn().mockResolvedValue([]);
    const check = createDbHealthChecker(fakeDb(queryRaw), () => currentTime);

    await check();
    currentTime = DB_HEALTH_CACHE_MS - 1;
    await check();
    expect(queryRaw).toHaveBeenCalledTimes(1);

    currentTime = DB_HEALTH_CACHE_MS;
    await check();
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('no cachea fallos: el siguiente chequeo vuelve a intentar', async () => {
    const queryRaw = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue([]);
    const check = createDbHealthChecker(fakeDb(queryRaw), () => 0);

    await expect(check()).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    await expect(check()).resolves.toMatchObject({ database: 'up' });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe('sin CORS (front y API comparten origen)', () => {
  it('no habilita orígenes cruzados, ni siquiera el del front', async () => {
    const res = await request(buildApp()).get('/api/health').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('manejo de errores', () => {
  const app = buildApp();

  it('devuelve 404 con formato uniforme para rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No existe la ruta GET /api/no-existe' },
    });
  });

  it('devuelve 400 ante JSON mal formado', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"mal": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('aplica headers de seguridad de helmet', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
