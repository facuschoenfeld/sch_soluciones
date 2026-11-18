import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../prisma/seed-runner.js';
import { createTtlCache } from '../src/lib/ttl-cache.js';
import { createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();

beforeAll(async () => {
  await resetDatabase(prisma);
  await runSeed(prisma, { adminEmail: 'admin@sch.test', adminPassword: 'contraseña-de-test' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('caché de respuestas públicas', () => {
  it('dentro de la vigencia no vuelve a consultar la base', async () => {
    const app = createTestApp(prisma, { options: { publicCacheTtlMs: 60_000 } });
    const first = await request(app).get('/api/public/settings');
    await prisma.settings.update({ where: { id: 1 }, data: { businessName: 'Otro nombre' } });
    const second = await request(app).get('/api/public/settings');

    expect(second.body.data.businessName).toBe(first.body.data.businessName);
    await prisma.settings.update({ where: { id: 1 }, data: { businessName: 'SCH Soluciones' } });
  });

  it('las búsquedas (?q=) no se cachean', async () => {
    const app = createTestApp(prisma, { options: { publicCacheTtlMs: 60_000 } });
    expect((await request(app).get('/api/public/services?q=windows')).body.data).toHaveLength(1);
    await prisma.service.update({
      where: { slug: 'instalacion-de-windows' },
      data: { isActive: false },
    });

    expect((await request(app).get('/api/public/services?q=windows')).body.data).toHaveLength(0);
    await prisma.service.update({
      where: { slug: 'instalacion-de-windows' },
      data: { isActive: true },
    });
  });

  it('no cachea errores (un 404 vuelve a consultar)', async () => {
    const app = createTestApp(prisma, { options: { publicCacheTtlMs: 60_000 } });
    expect((await request(app).get('/api/public/services/landing-page')).status).toBe(200);
    expect((await request(app).get('/api/public/services/no-existe')).status).toBe(404);
  });
});

describe('createTtlCache', () => {
  it('vence las entradas y respeta el tope de claves', async () => {
    let now = 0;
    const cache = createTtlCache(1000, { maxEntries: 2, now: () => now });
    let loads = 0;
    const load = async () => ++loads;

    await cache.get('a', load);
    await cache.get('a', load);
    expect(loads).toBe(1);

    now = 1000;
    await cache.get('a', load);
    expect(loads).toBe(2);

    await cache.get('b', load);
    await cache.get('c', load); // desplaza a "a"
    await cache.get('a', load);
    expect(loads).toBe(5);
  });

  it('pedidos simultáneos con la caché vacía comparten una sola consulta', async () => {
    const cache = createTtlCache(1000);
    let loads = 0;
    const load = async () => {
      loads++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return loads;
    };

    const results = await Promise.all([cache.get('a', load), cache.get('a', load)]);
    expect(loads).toBe(1);
    expect(results).toEqual([1, 1]);
  });

  it('si la consulta falla no guarda nada y la siguiente vuelve a intentar', async () => {
    const cache = createTtlCache(1000);
    await expect(cache.get('a', () => Promise.reject(new Error('base caída')))).rejects.toThrow();
    await expect(cache.get('a', async () => 'ok')).resolves.toBe('ok');
  });

  it('clear() con una consulta en curso no deja datos viejos en la caché', async () => {
    const cache = createTtlCache(1000);
    let release: (value: string) => void = () => undefined;
    const slow = cache.get('a', () => new Promise<string>((resolve) => (release = resolve)));
    cache.clear();
    release('viejo');
    await slow;

    await expect(cache.get('a', async () => 'nuevo')).resolves.toBe('nuevo');
  });

  it('con vigencia 0 no guarda nada', async () => {
    const cache = createTtlCache(0);
    let loads = 0;
    await cache.get('a', async () => ++loads);
    await cache.get('a', async () => ++loads);
    expect(loads).toBe(2);
  });
});

describe('límite global de peticiones a /api', () => {
  it('responde 429 al superar el límite, salvo /api/health (monitor)', async () => {
    const app = createTestApp(prisma, { options: { rateLimits: { apiPerIp: 2 } } });
    await request(app).get('/api/public/categories');
    await request(app).get('/api/public/categories');
    const blocked = await request(app).get('/api/public/categories');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
