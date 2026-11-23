import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/app-error.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { updateJob } from '../src/modules/jobs/jobs.service.js';
import { PDF_EXPORT_MAX_ROWS, type AdminJob } from '@sch/shared';
import {
  adminClient,
  loginAdmin,
  loginAsAdmin,
  type AdminClient,
} from './helpers/admin-session.js';
import { TEST_ORIGIN, createTestApp } from './helpers/test-app.js';
import { binary } from './helpers/binary-parser.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const FIXED_NOW = new Date('2026-11-23T18:30:00.000Z');
const app = createTestApp(prisma, { options: { now: () => FIXED_NOW.getTime() } });
let admin: AdminClient;
let clientId = 0;
let serviceId = 0;

beforeEach(async () => {
  await resetDatabase(prisma);
  admin = adminClient(app, await loginAsAdmin(app, prisma));
  const client = await prisma.client.create({
    data: { fullName: 'Ana Pérez', phone: '541122334455' },
  });
  clientId = client.id;
  const category = await prisma.category.create({
    data: { name: 'Mantenimiento', slug: 'mantenimiento', line: 'TECH_SUPPORT' },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: 'Limpieza de PC',
      slug: 'limpieza-de-pc',
      shortDescription: 'Limpieza',
      description: 'desc',
      priceType: 'FIXED',
      priceAmount: 25000,
      currency: 'ARS',
    },
  });
  serviceId = service.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function validJob(overrides: Record<string, unknown> = {}) {
  return {
    clientId,
    serviceId: null,
    title: 'Reparar notebook',
    description: null,
    deviceInfo: null,
    status: 'QUOTED',
    amountCharged: 10000,
    currency: 'ARS',
    amountPaid: 0,
    receivedAt: '2026-11-20T15:00:00.000Z',
    scheduledAt: null,
    completedAt: null,
    internalNotes: null,
    ...overrides,
  };
}

async function createJob(overrides: Record<string, unknown> = {}) {
  const res = await admin.post('/api/admin/jobs', validJob(overrides));
  expect(res.status).toBe(201);
  return res.body.data as AdminJob;
}

const fieldPaths = (body: { error: { details?: { path: string[] }[] } }) =>
  (body.error.details ?? []).map((detail) => detail.path[0]);

describe('acceso', () => {
  it('sin sesión todo responde 401', async () => {
    const job = await createJob();
    const responses = await Promise.all([
      request(app).get('/api/admin/jobs'),
      request(app).get(`/api/admin/jobs/${job.id}`),
      request(app).get('/api/admin/jobs/export?format=csv'),
      request(app).post('/api/admin/jobs').set('Origin', TEST_ORIGIN).send(validJob()),
      request(app).patch(`/api/admin/jobs/${job.id}`).set('Origin', TEST_ORIGIN).send({}),
      request(app).delete(`/api/admin/jobs/${job.id}`).set('Origin', TEST_ORIGIN).send({}),
    ]);
    for (const res of responses) expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/jobs', () => {
  it('crea sin servicio: snapshot vacío, cliente embebido, montos como number', async () => {
    const res = await admin.post(
      '/api/admin/jobs',
      validJob({
        deviceInfo: { brand: 'HP', model: '', serialNumber: null, reportedIssue: 'No enciende' },
        amountPaid: 2500.5,
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      clientId,
      client: { id: clientId, fullName: 'Ana Pérez', phone: '541122334455' },
      serviceId: null,
      serviceNameSnapshot: null,
      servicePriceSnapshot: null,
      servicePriceTypeSnapshot: null,
      serviceCurrencySnapshot: null,
      amountCharged: 10000,
      amountPaid: 2500.5,
      receivedAt: '2026-11-20T15:00:00.000Z',
      completedAt: null,
      deviceInfo: { brand: 'HP', model: null, serialNumber: null, reportedIssue: 'No enciende' },
    });
  });

  it('deviceInfo con todo vacío se guarda como null', async () => {
    const job = await createJob({
      deviceInfo: { brand: '', model: ' ', serialNumber: null, reportedIssue: '' },
    });
    expect(job.deviceInfo).toBeNull();
  });

  it('con servicio guarda el snapshot de nombre, precio, tipo y moneda', async () => {
    const job = await createJob({ serviceId });
    expect(job).toMatchObject({
      serviceId,
      serviceNameSnapshot: 'Limpieza de PC',
      servicePriceSnapshot: 25000,
      servicePriceTypeSnapshot: 'FIXED',
      serviceCurrencySnapshot: 'ARS',
      service: { id: serviceId, name: 'Limpieza de PC', isActive: true },
    });
  });

  it('servicio "a consultar": snapshot sin precio ni moneda', async () => {
    const quote = await prisma.service.create({
      data: {
        categoryId: (await prisma.category.findFirstOrThrow()).id,
        name: 'Presupuesto',
        slug: 'presupuesto',
        shortDescription: 's',
        description: 'd',
        priceType: 'QUOTE',
        priceAmount: null,
      },
    });
    const job = await createJob({ serviceId: quote.id });
    expect(job).toMatchObject({
      servicePriceSnapshot: null,
      servicePriceTypeSnapshot: 'QUOTE',
      serviceCurrencySnapshot: null,
    });
  });

  it('serviceId inexistente -> 400 con path serviceId', async () => {
    const res = await admin.post('/api/admin/jobs', validJob({ serviceId: 9999 }));
    expect(res.status).toBe(400);
    expect(fieldPaths(res.body)).toEqual(['serviceId']);
  });

  it('clientId inexistente -> 400 con path clientId', async () => {
    const res = await admin.post('/api/admin/jobs', validJob({ clientId: 9999 }));
    expect(res.status).toBe(400);
    expect(fieldPaths(res.body)).toEqual(['clientId']);
  });

  it('COMPLETED y DELIVERED sin completedAt se completan con la hora actual', async () => {
    const completed = await createJob({ status: 'COMPLETED' });
    expect(completed.completedAt).toBe(FIXED_NOW.toISOString());
    const delivered = await createJob({ status: 'DELIVERED' });
    expect(delivered.completedAt).toBe(FIXED_NOW.toISOString());
  });

  it('respeta un completedAt enviado y no completa estados abiertos', async () => {
    const explicit = await createJob({
      status: 'COMPLETED',
      completedAt: '2026-11-10T12:00:00.000Z',
    });
    expect(explicit.completedAt).toBe('2026-11-10T12:00:00.000Z');
    expect((await createJob({ status: 'IN_PROGRESS' })).completedAt).toBeNull();
    expect((await createJob({ status: 'CANCELLED' })).completedAt).toBeNull();
  });

  it('amountPaid > amountCharged -> 400 en amountPaid', async () => {
    const res = await admin.post('/api/admin/jobs', validJob({ amountPaid: 10000.01 }));
    expect(res.status).toBe(400);
    expect(fieldPaths(res.body)).toEqual(['amountPaid']);
  });

  it('rechaza título vacío, monto negativo y fecha mal formada', async () => {
    const res = await admin.post(
      '/api/admin/jobs',
      validJob({ title: '', amountCharged: -5, receivedAt: 'hoy' }),
    );
    expect(res.status).toBe(400);
    expect(fieldPaths(res.body)).toEqual(
      expect.arrayContaining(['title', 'amountCharged', 'receivedAt']),
    );
  });
});

describe('GET /api/admin/jobs', () => {
  it('ordena por receivedAt desc y pagina', async () => {
    await createJob({ title: 'Viejo', receivedAt: '2026-11-01T12:00:00.000Z' });
    await createJob({ title: 'Nuevo', receivedAt: '2026-11-20T12:00:00.000Z' });
    await createJob({ title: 'Medio', receivedAt: '2026-11-10T12:00:00.000Z' });

    const res = await admin.get('/api/admin/jobs');
    expect(res.status).toBe(200);
    expect(res.body.data.map((j: AdminJob) => j.title)).toEqual(['Nuevo', 'Medio', 'Viejo']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 3 });

    const page2 = await admin.get('/api/admin/jobs?page=2&pageSize=2');
    expect(page2.body.data.map((j: AdminJob) => j.title)).toEqual(['Viejo']);
    expect(page2.body.meta.total).toBe(3);
  });

  it('filtra por status, clientId y serviceId', async () => {
    const other = await prisma.client.create({ data: { fullName: 'Otro', phone: '1100000000' } });
    await createJob({ title: 'A', status: 'QUOTED' });
    await createJob({ title: 'B', status: 'IN_PROGRESS', serviceId });
    await createJob({ title: 'C', clientId: other.id });

    const titles = async (query: string) =>
      ((await admin.get(`/api/admin/jobs?${query}`)).body.data as AdminJob[])
        .map((j) => j.title)
        .sort();
    expect(await titles('status=IN_PROGRESS')).toEqual(['B']);
    expect(await titles(`clientId=${other.id}`)).toEqual(['C']);
    expect(await titles(`serviceId=${serviceId}`)).toEqual(['B']);
    expect(await titles(`clientId=${clientId}&status=QUOTED`)).toEqual(['A']);
  });

  it('from/to: días completos en hora argentina, ambos inclusive', async () => {
    // 23/11 02:59 UTC = 22/11 23:59 AR; 23/11 03:00 UTC = 23/11 00:00 AR.
    await createJob({ title: 'antes', receivedAt: '2026-11-23T02:59:59.999Z' });
    await createJob({ title: 'inicio', receivedAt: '2026-11-23T03:00:00.000Z' });
    await createJob({ title: 'fin', receivedAt: '2026-11-24T02:59:59.999Z' });
    await createJob({ title: 'despues', receivedAt: '2026-11-24T03:00:00.000Z' });

    const titles = async (query: string) =>
      ((await admin.get(`/api/admin/jobs?${query}`)).body.data as AdminJob[])
        .map((j) => j.title)
        .sort();
    expect(await titles('from=2026-11-23&to=2026-11-23')).toEqual(['fin', 'inicio']);
    expect(await titles('from=2026-11-24')).toEqual(['despues']);
    expect(await titles('to=2026-11-22')).toEqual(['antes']);
  });

  it('from > to o fecha imposible -> 400', async () => {
    expect((await admin.get('/api/admin/jobs?from=2026-11-10&to=2026-11-09')).status).toBe(400);
    expect((await admin.get('/api/admin/jobs?from=2026-02-31')).status).toBe(400);
    // Mismo rango de años que las fechas de los trabajos.
    expect((await admin.get('/api/admin/jobs?to=9999-12-31')).status).toBe(400);
    expect((await admin.get('/api/admin/jobs?from=1999-12-31')).status).toBe(400);
    expect((await admin.get('/api/admin/jobs?status=NOPE')).status).toBe(400);
  });

  it('balanceDue=true: solo COMPLETED/DELIVERED con pagado < total', async () => {
    await createJob({ title: 'terminado-debe', status: 'COMPLETED', amountPaid: 100 });
    await createJob({ title: 'entregado-debe', status: 'DELIVERED', amountPaid: 0 });
    await createJob({ title: 'terminado-pago', status: 'COMPLETED', amountPaid: 10000 });
    await createJob({ title: 'sin-cargo', status: 'COMPLETED', amountCharged: 0 });
    await createJob({ title: 'en-curso-debe', status: 'IN_PROGRESS', amountPaid: 0 });
    await createJob({ title: 'cancelado-debe', status: 'CANCELLED', amountPaid: 0 });

    const res = await admin.get('/api/admin/jobs?balanceDue=true');
    expect((res.body.data as AdminJob[]).map((j) => j.title).sort()).toEqual([
      'entregado-debe',
      'terminado-debe',
    ]);
    expect(res.body.meta.total).toBe(2);

    const all = await admin.get('/api/admin/jobs?balanceDue=false');
    expect(all.body.meta.total).toBe(6);
  });
});

describe('GET /api/admin/jobs/:id', () => {
  it('devuelve el trabajo; 404 inexistente o id inválido', async () => {
    const job = await createJob();
    const res = await admin.get(`/api/admin/jobs/${job.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(job.id);
    const missing = await admin.get('/api/admin/jobs/999');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('JOB_NOT_FOUND');
    expect((await admin.get('/api/admin/jobs/abc')).status).toBe(404);
  });
});

describe('PATCH /api/admin/jobs/:id', () => {
  it('actualiza solo lo enviado', async () => {
    const job = await createJob();
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, {
      title: ' Nuevo título ',
      amountPaid: 500,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Nuevo título',
      amountPaid: 500,
      amountCharged: 10000,
      status: 'QUOTED',
    });
  });

  it('cambiar el precio del servicio después NO cambia el snapshot del trabajo', async () => {
    const job = await createJob({ serviceId });
    await prisma.service.update({
      where: { id: serviceId },
      data: { name: 'Nombre nuevo', priceAmount: 99999, currency: 'USD' },
    });

    // Aun editando otra cosa del trabajo, el snapshot se mantiene.
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, { internalNotes: 'nota' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      serviceNameSnapshot: 'Limpieza de PC',
      servicePriceSnapshot: 25000,
      serviceCurrencySnapshot: 'ARS',
      service: { name: 'Nombre nuevo' },
    });
  });

  it('reenviar el mismo serviceId no re-toma el snapshot', async () => {
    const job = await createJob({ serviceId });
    await prisma.service.update({ where: { id: serviceId }, data: { priceAmount: 30000 } });
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, { serviceId });
    expect(res.body.data.servicePriceSnapshot).toBe(25000);
  });

  it('cambiar serviceId re-toma el snapshot; null lo limpia', async () => {
    const job = await createJob({ serviceId });
    const second = await prisma.service.create({
      data: {
        categoryId: (await prisma.category.findFirstOrThrow()).id,
        name: 'Formateo',
        slug: 'formateo',
        shortDescription: 's',
        description: 'd',
        priceType: 'FIXED',
        priceAmount: 12000.5,
        currency: 'USD',
      },
    });
    const changed = await admin.patch(`/api/admin/jobs/${job.id}`, { serviceId: second.id });
    expect(changed.body.data).toMatchObject({
      serviceId: second.id,
      serviceNameSnapshot: 'Formateo',
      servicePriceSnapshot: 12000.5,
      serviceCurrencySnapshot: 'USD',
    });

    const cleared = await admin.patch(`/api/admin/jobs/${job.id}`, { serviceId: null });
    expect(cleared.body.data).toMatchObject({
      serviceId: null,
      service: null,
      serviceNameSnapshot: null,
      servicePriceSnapshot: null,
      servicePriceTypeSnapshot: null,
      serviceCurrencySnapshot: null,
    });
  });

  it('serviceId o clientId inexistentes -> 400 en el campo', async () => {
    const job = await createJob();
    const badService = await admin.patch(`/api/admin/jobs/${job.id}`, { serviceId: 9999 });
    expect(badService.status).toBe(400);
    expect(fieldPaths(badService.body)).toEqual(['serviceId']);
    const badClient = await admin.patch(`/api/admin/jobs/${job.id}`, { clientId: 9999 });
    expect(badClient.status).toBe(400);
    expect(fieldPaths(badClient.body)).toEqual(['clientId']);
  });

  it('DELIVERED -> CANCELLED = 409 INVALID_STATUS_CHANGE (y no cambia nada)', async () => {
    const job = await createJob({ status: 'DELIVERED' });
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'CANCELLED' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_CHANGE');
    expect((await admin.get(`/api/admin/jobs/${job.id}`)).body.data.status).toBe('DELIVERED');
  });

  it('retroceder y reabrir un cancelado se permiten', async () => {
    const job = await createJob({ status: 'COMPLETED' });
    expect(
      (await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'IN_PROGRESS' })).body.data.status,
    ).toBe('IN_PROGRESS');
    await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'CANCELLED' });
    const reopened = await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'QUOTED' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.status).toBe('QUOTED');
    // DELIVERED -> otro estado que no sea cancelar también se permite.
    const delivered = await createJob({ status: 'DELIVERED' });
    expect(
      (await admin.patch(`/api/admin/jobs/${delivered.id}`, { status: 'IN_PROGRESS' })).status,
    ).toBe(200);
  });

  it('amountPaid > amountCharged combinado: 400 en el campo enviado', async () => {
    const job = await createJob({ amountCharged: 1000, amountPaid: 800 });

    const paid = await admin.patch(`/api/admin/jobs/${job.id}`, { amountPaid: 1001 });
    expect(paid.status).toBe(400);
    expect(fieldPaths(paid.body)).toEqual(['amountPaid']);

    // Bajar solo el total por debajo de lo pagado: el error va en amountCharged.
    const charged = await admin.patch(`/api/admin/jobs/${job.id}`, { amountCharged: 500 });
    expect(charged.status).toBe(400);
    expect(fieldPaths(charged.body)).toEqual(['amountCharged']);

    // Cambiando ambos de forma consistente sí se puede.
    const both = await admin.patch(`/api/admin/jobs/${job.id}`, {
      amountCharged: 500,
      amountPaid: 500,
    });
    expect(both.status).toBe(200);
  });

  it('pasar a COMPLETED/DELIVERED sin completedAt lo completa con la hora actual', async () => {
    const job = await createJob({ status: 'IN_PROGRESS' });
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'DELIVERED' });
    expect(res.body.data.completedAt).toBe(FIXED_NOW.toISOString());
  });

  it('no pisa un completedAt existente al avanzar de COMPLETED a DELIVERED', async () => {
    const job = await createJob({
      status: 'COMPLETED',
      completedAt: '2026-11-10T12:00:00.000Z',
    });
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'DELIVERED' });
    expect(res.body.data.completedAt).toBe('2026-11-10T12:00:00.000Z');
  });

  it('se puede limpiar deviceInfo con null', async () => {
    const job = await createJob({
      deviceInfo: { brand: 'HP', model: null, serialNumber: null, reportedIssue: null },
    });
    expect(job.deviceInfo?.brand).toBe('HP');
    const res = await admin.patch(`/api/admin/jobs/${job.id}`, { deviceInfo: null });
    expect(res.body.data.deviceInfo).toBeNull();
  });

  it('404 inexistente y 400 con datos inválidos', async () => {
    expect((await admin.patch('/api/admin/jobs/999', { title: 'x' })).status).toBe(404);
    const job = await createJob();
    expect((await admin.patch(`/api/admin/jobs/${job.id}`, { status: 'NOPE' })).status).toBe(400);
  });
});

describe('PATCH /api/admin/jobs/:id: fecha de terminado al reabrir', () => {
  // Reloj controlable: cada test lo mueve para distinguir "completado antes" de "completado ahora".
  let clock = FIXED_NOW.getTime();
  const clockApp = createTestApp(prisma, { options: { now: () => clock } });
  let clockAdmin: AdminClient;

  beforeEach(async () => {
    clock = FIXED_NOW.getTime();
    clockAdmin = adminClient(clockApp, await loginAdmin(clockApp));
  });

  async function createCompleted() {
    const res = await clockAdmin.post('/api/admin/jobs', validJob({ status: 'COMPLETED' }));
    expect(res.status).toBe(201);
    expect(res.body.data.completedAt).toBe(FIXED_NOW.toISOString());
    return res.body.data as AdminJob;
  }

  it.each(['IN_PROGRESS', 'CANCELLED'])(
    'reabrir un terminado (COMPLETED -> %s) sin completedAt lo deja en null',
    async (status) => {
      const job = await createCompleted();
      const res = await clockAdmin.patch(`/api/admin/jobs/${job.id}`, { status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
      expect(res.body.data.completedAt).toBeNull();
    },
  );

  it('al volver a COMPLETED después se completa con el reloj actual', async () => {
    const job = await createCompleted();
    await clockAdmin.patch(`/api/admin/jobs/${job.id}`, { status: 'IN_PROGRESS' });
    clock += 60 * 60 * 1000;
    const res = await clockAdmin.patch(`/api/admin/jobs/${job.id}`, { status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBe(new Date(clock).toISOString());
    expect(res.body.data.completedAt).not.toBe(FIXED_NOW.toISOString());
  });

  it('al terminar un trabajo abierto se usa la hora actual aunque tuviera otra fecha cargada', async () => {
    const created = await clockAdmin.post(
      '/api/admin/jobs',
      validJob({ status: 'IN_PROGRESS', completedAt: '2026-10-01T12:00:00.000Z' }),
    );
    expect(created.body.data.completedAt).toBe('2026-10-01T12:00:00.000Z');
    const res = await clockAdmin.patch(`/api/admin/jobs/${created.body.data.id}`, {
      status: 'COMPLETED',
    });
    expect(res.body.data.completedAt).toBe(FIXED_NOW.toISOString());
  });

  it('si el PATCH trae completedAt explícito, se respeta al reabrir', async () => {
    const job = await createCompleted();
    const res = await clockAdmin.patch(`/api/admin/jobs/${job.id}`, {
      status: 'IN_PROGRESS',
      completedAt: '2026-11-01T12:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('si el PATCH trae completedAt explícito, se respeta al terminar', async () => {
    const job = await clockAdmin.post('/api/admin/jobs', validJob({ status: 'IN_PROGRESS' }));
    const res = await clockAdmin.patch(`/api/admin/jobs/${job.body.data.id}`, {
      status: 'COMPLETED',
      completedAt: '2026-11-02T12:00:00.000Z',
    });
    expect(res.body.data.completedAt).toBe('2026-11-02T12:00:00.000Z');
  });
});

describe('updateJob: guarda optimista', () => {
  type Method = (...args: unknown[]) => unknown;
  const bound = (target: object, key: string | symbol): unknown => {
    const value: unknown = Reflect.get(target, key);
    return typeof value === 'function' ? (value as Method).bind(target) : value;
  };

  /**
   * `prisma` cuyo primer `job.findUnique` resuelve y, a continuación, otra "petición" cambia la
   * fila (`concurrent`) antes de que `updateJob` escriba.
   */
  function prismaWithConcurrentChange(concurrent: () => Promise<unknown>): PrismaClient {
    let intercepted = false;
    const jobProxy = new Proxy(prisma.job, {
      get(target, key) {
        if (key !== 'findUnique') return bound(target, key);
        return async (args: Parameters<typeof prisma.job.findUnique>[0]) => {
          const result = await target.findUnique(args);
          if (!intercepted) {
            intercepted = true;
            await concurrent();
          }
          return result;
        };
      },
    });
    return new Proxy(prisma, {
      get: (target, key) => (key === 'job' ? jobProxy : bound(target, key)),
    });
  }

  it('si otra petición modifica la fila entre la lectura y la escritura -> 409 JOB_CHANGED', async () => {
    const job = await createJob();
    const wrapped = prismaWithConcurrentChange(() =>
      prisma.job.update({
        where: { id: job.id },
        data: { title: 'Editado por otra pestaña', updatedAt: new Date(Date.now() + 5000) },
      }),
    );
    const error = await updateJob(wrapped, job.id, { amountPaid: 100 }, FIXED_NOW).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 409, code: 'JOB_CHANGED' });
    // No pisó nada: queda lo de la otra petición.
    const stored = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(stored.title).toBe('Editado por otra pestaña');
    expect(stored.amountPaid.toNumber()).toBe(0);
  });

  it('sin edición concurrente guarda normalmente', async () => {
    const job = await createJob();
    const updated = await updateJob(prisma, job.id, { amountPaid: 100 }, FIXED_NOW);
    expect(updated.amountPaid).toBe(100);
  });

  it('si la fila se borró en el medio -> 404 JOB_NOT_FOUND (no JOB_CHANGED)', async () => {
    const job = await createJob();
    const wrapped = prismaWithConcurrentChange(() => prisma.job.delete({ where: { id: job.id } }));
    const error = await updateJob(wrapped, job.id, { amountPaid: 1 }, FIXED_NOW).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ status: 404, code: 'JOB_NOT_FOUND' });
  });
});

describe('historial frente a cambios en el servicio', () => {
  it('un servicio con trabajos no se puede borrar desde la API (409)', async () => {
    await createJob({ serviceId });
    const res = await admin.delete(`/api/admin/services/${serviceId}`);
    expect(res.status).toBe(409);
  });

  it('borrar el registro del servicio deja serviceId null y el snapshot intacto', async () => {
    const job = await createJob({ serviceId });
    await prisma.service.delete({ where: { id: serviceId } });

    const list = await admin.get('/api/admin/jobs');
    expect(list.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({
      id: job.id,
      serviceId: null,
      service: null,
      serviceNameSnapshot: 'Limpieza de PC',
      servicePriceSnapshot: 25000,
      servicePriceTypeSnapshot: 'FIXED',
      serviceCurrencySnapshot: 'ARS',
    });
    const one = await admin.get(`/api/admin/jobs/${job.id}`);
    expect(one.status).toBe(200);
    // Se sigue pudiendo editar y exportar.
    expect((await admin.patch(`/api/admin/jobs/${job.id}`, { internalNotes: 'x' })).status).toBe(
      200,
    );
    expect((await admin.get('/api/admin/jobs/export?format=csv')).status).toBe(200);
  });

  it('archivar el servicio no rompe el trabajo', async () => {
    const job = await createJob({ serviceId });
    const archived = await admin.patch(`/api/admin/services/${serviceId}`, { isActive: false });
    expect(archived.status).toBe(200);
    const res = await admin.get(`/api/admin/jobs/${job.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      serviceId,
      service: { id: serviceId, isActive: false },
      serviceNameSnapshot: 'Limpieza de PC',
      servicePriceSnapshot: 25000,
    });
  });
});

describe('DELETE /api/admin/jobs/:id', () => {
  it('204 y desaparece; 404 si no existe', async () => {
    const job = await createJob();
    expect((await admin.delete(`/api/admin/jobs/${job.id}`)).status).toBe(204);
    expect((await admin.get(`/api/admin/jobs/${job.id}`)).status).toBe(404);
    const again = await admin.delete(`/api/admin/jobs/${job.id}`);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('el cliente queda sin trabajos y se puede borrar', async () => {
    const job = await createJob();
    await admin.delete(`/api/admin/jobs/${job.id}`);
    expect((await admin.delete(`/api/admin/clients/${clientId}`)).status).toBe(204);
  });
});

describe('GET /api/admin/jobs/export', () => {
  it('CSV con filtros: headers, saldo, formato es-AR y sin inyección de fórmulas', async () => {
    await createJob({
      title: '=HYPERLINK("x")',
      status: 'COMPLETED',
      amountCharged: 1500.5,
      amountPaid: 500,
      serviceId,
      receivedAt: '2026-11-20T15:00:00.000Z',
    });
    await createJob({ title: 'Otro', status: 'QUOTED' });

    const res = await admin
      .get('/api/admin/jobs/export?format=csv&status=COMPLETED&from=2026-11-20&to=2026-11-20')
      .buffer()
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="trabajos-2026-11-23.csv"',
    );
    const text = (res.body as Buffer).toString('utf8');
    expect(text).toContain('Ingreso;Cliente;Teléfono;Trabajo');
    expect(text).not.toContain('Otro');
    expect(text).toContain('"\'=HYPERLINK(""x"")"');
    expect(text).toContain('1500,50;500,00;1000,50');
    expect(text).toContain('Limpieza de PC');
    expect(text).toContain('Terminado');
    expect(text).toContain('20/11/2026');
    // El teléfono va como texto para que Excel no lo pase a notación científica.
    expect(text).toContain('"=""541122334455"""');
  });

  it('PDF con filtros', async () => {
    await createJob();
    const res = await admin
      .get(`/api/admin/jobs/export?format=pdf&clientId=${clientId}&serviceId=${serviceId}`)
      .buffer()
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="trabajos-2026-11-23.pdf"',
    );
    expect((res.body as Buffer).subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('PDF con más de 1000 trabajos -> 400 EXPORT_TOO_LARGE; el CSV sí sale', async () => {
    await prisma.job.createMany({
      data: Array.from({ length: PDF_EXPORT_MAX_ROWS + 1 }, (_, index) => ({
        clientId,
        title: `Trabajo ${index}`,
      })),
    });
    const pdf = await admin.get('/api/admin/jobs/export?format=pdf');
    expect(pdf.status).toBe(400);
    expect(pdf.body.error.code).toBe('EXPORT_TOO_LARGE');
    expect(pdf.body.error.message).toContain('CSV');
    const csv = await admin.get('/api/admin/jobs/export?format=csv').buffer().parse(binary);
    expect(csv.status).toBe(200);
  });

  it('400 sin format, con format inválido o con rango invertido', async () => {
    expect((await admin.get('/api/admin/jobs/export')).status).toBe(400);
    expect((await admin.get('/api/admin/jobs/export?format=doc')).status).toBe(400);
    expect(
      (await admin.get('/api/admin/jobs/export?format=csv&from=2026-11-10&to=2026-11-01')).status,
    ).toBe(400);
  });
});
