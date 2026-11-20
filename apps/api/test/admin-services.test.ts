import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminServiceDetail, AdminServiceSummary, BulkPriceResult } from '@sch/shared';
import { adminClient, loginAsAdmin, type AdminClient } from './helpers/admin-session.js';
import { TEST_ORIGIN, createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const app = createTestApp(prisma);
let admin: AdminClient;
let sessionCookie = '';
let categoryId = 0;
let otherCategoryId = 0;

beforeEach(async () => {
  await resetDatabase(prisma);
  sessionCookie = await loginAsAdmin(app, prisma);
  admin = adminClient(app, sessionCookie);
  const category = await prisma.category.create({
    data: { name: 'Mantenimiento', slug: 'mantenimiento', line: 'TECH_SUPPORT' },
  });
  const other = await prisma.category.create({
    data: { name: 'Web', slug: 'web', line: 'DEVELOPMENT', sortOrder: 1 },
  });
  categoryId = category.id;
  otherCategoryId = other.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function validService(overrides: Record<string, unknown> = {}) {
  return {
    categoryId,
    name: 'Limpieza de PC',
    slug: 'limpieza-de-pc',
    shortDescription: 'Limpieza interna y cambio de pasta térmica',
    description: '## Incluye\n\n- Soplado\n- Pasta térmica',
    priceType: 'FIXED',
    priceAmount: 25000,
    currency: 'ARS',
    priceUnit: 'por equipo',
    estimatedTime: '24 h',
    whatsappTemplate: null,
    isActive: true,
    isFeatured: false,
    ...overrides,
  };
}

async function createService(overrides: Record<string, unknown> = {}) {
  const res = await admin.post('/api/admin/services', validService(overrides));
  expect(res.status).toBe(201);
  return res.body.data as AdminServiceDetail;
}

async function addJob(serviceId: number) {
  const client = await prisma.client.create({ data: { fullName: 'Cliente', phone: '1100000000' } });
  await prisma.job.create({
    data: { clientId: client.id, serviceId, title: 'Trabajo', serviceNameSnapshot: 'Limpieza' },
  });
}

describe('acceso', () => {
  it('con sesión igual exige Origin permitido (403) y JSON (415) en las escrituras', async () => {
    const created = await createService();
    const noOrigin = await request(app)
      .patch(`/api/admin/services/${created.id}`)
      .set('Cookie', sessionCookie)
      .send({ isActive: false });
    expect(noOrigin.status).toBe(403);

    const notJson = await request(app)
      .patch(`/api/admin/services/${created.id}`)
      .set('Cookie', sessionCookie)
      .set('Origin', TEST_ORIGIN)
      .type('form')
      .send('isActive=false');
    expect(notJson.status).toBe(415);
  });

  it('sin sesión responde 401 en lecturas y escrituras', async () => {
    expect((await request(app).get('/api/admin/services')).status).toBe(401);
    const write = request(app).post('/api/admin/services/bulk-price').set('Origin', TEST_ORIGIN);
    expect((await write.send({})).status).toBe(401);
  });
});

describe('POST /api/admin/services', () => {
  it('crea el servicio con todos los campos y lo ubica al final de su categoría', async () => {
    const first = await createService();
    const second = await createService({ name: 'Formateo', slug: 'formateo' });

    expect(first).toMatchObject({
      ...validService(),
      sortOrder: 0,
      jobsCount: 0,
      category: { id: categoryId, name: 'Mantenimiento', line: 'TECH_SUPPORT', isActive: true },
    });
    expect(typeof first.priceUpdatedAt).toBe('string');
    expect(second.sortOrder).toBe(1);
  });

  it('en "a consultar" ignora el monto y lo guarda como null', async () => {
    const created = await createService({ priceType: 'QUOTE', priceAmount: 5000 });
    expect(created.priceAmount).toBeNull();
  });

  it('exige monto para precio fijo o "desde"', async () => {
    const res = await admin.post('/api/admin/services', validService({ priceAmount: null }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: ['priceAmount'], message: expect.any(String) },
    ]);
  });

  it.each([
    ['monto negativo', { priceAmount: -1 }],
    ['más de 2 decimales', { priceAmount: 10.123 }],
    ['moneda desconocida', { currency: 'EUR' }],
    ['slug inválido', { slug: 'Limpieza PC' }],
    ['nombre vacío', { name: '  ' }],
    ['descripción corta demasiado larga', { shortDescription: 'x'.repeat(301) }],
  ])('rechaza %s (400)', async (_label, overrides) => {
    const res = await admin.post('/api/admin/services', validService(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza una categoría inexistente en el campo categoryId', async () => {
    const res = await admin.post('/api/admin/services', validService({ categoryId: 9999 }));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toEqual(['categoryId']);
  });

  it('responde 409 si el slug ya existe', async () => {
    await createService();
    const res = await admin.post('/api/admin/services', validService({ name: 'Otro' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
  });
});

describe('GET /api/admin/services', () => {
  it('lista activos y archivados, con la cantidad de trabajos', async () => {
    const active = await createService();
    await createService({ name: 'Archivado', slug: 'archivado', isActive: false });
    await addJob(active.id);

    const res = await admin.get('/api/admin/services');
    expect(res.status).toBe(200);
    const list = res.body.data as AdminServiceSummary[];
    expect(list.map((s) => s.slug)).toEqual(['limpieza-de-pc', 'archivado']);
    expect(list[0]?.jobsCount).toBe(1);
    expect(list[0]).not.toHaveProperty('description');
  });

  it('GET /:id devuelve el detalle o 404', async () => {
    const created = await createService();
    const res = await admin.get(`/api/admin/services/${created.id}`);
    expect(res.body.data.description).toContain('Pasta térmica');
    expect((await admin.get('/api/admin/services/9999')).status).toBe(404);
  });
});

describe('PATCH /api/admin/services/:id', () => {
  it('archiva y restaura sin tocar priceUpdatedAt', async () => {
    const created = await createService();
    const archived = await admin.patch(`/api/admin/services/${created.id}`, { isActive: false });
    expect(archived.body.data.isActive).toBe(false);
    expect(archived.body.data.priceUpdatedAt).toBe(created.priceUpdatedAt);

    const publicRes = await request(app).get('/api/public/services/limpieza-de-pc');
    expect(publicRes.status).toBe(404);

    const restored = await admin.patch(`/api/admin/services/${created.id}`, { isActive: true });
    expect(restored.body.data.isActive).toBe(true);
  });

  it('cambiar el precio actualiza priceUpdatedAt y se refleja en el sitio', async () => {
    const created = await createService();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const res = await admin.patch(`/api/admin/services/${created.id}`, { priceAmount: 30000 });

    expect(res.status).toBe(200);
    expect(res.body.data.priceAmount).toBe(30000);
    expect(new Date(res.body.data.priceUpdatedAt).getTime()).toBeGreaterThan(
      new Date(created.priceUpdatedAt).getTime(),
    );
    const publicRes = await request(app).get('/api/public/services/limpieza-de-pc');
    expect(publicRes.body.data.priceAmount).toBe(30000);
  });

  it('pasar a "a consultar" borra el monto; volver a fijo sin monto es un error', async () => {
    const created = await createService();
    const quote = await admin.patch(`/api/admin/services/${created.id}`, { priceType: 'QUOTE' });
    expect(quote.body.data).toMatchObject({ priceType: 'QUOTE', priceAmount: null });

    const fixed = await admin.patch(`/api/admin/services/${created.id}`, { priceType: 'FIXED' });
    expect(fixed.status).toBe(400);
    expect(fixed.body.error.details[0].path).toEqual(['priceAmount']);
  });

  it('rechaza un monto suelto para un servicio "a consultar" (no lo descarta en silencio)', async () => {
    const created = await createService({ priceType: 'QUOTE' });
    const res = await admin.patch(`/api/admin/services/${created.id}`, { priceAmount: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toEqual(['priceAmount']);
  });

  it('al cambiar de categoría lo ubica al final de la nueva', async () => {
    await prisma.service.create({
      data: {
        categoryId: otherCategoryId,
        name: 'Landing',
        slug: 'landing',
        shortDescription: 'x',
        priceType: 'QUOTE',
        sortOrder: 4,
      },
    });
    const created = await createService();
    const res = await admin.patch(`/api/admin/services/${created.id}`, {
      categoryId: otherCategoryId,
    });
    expect(res.body.data).toMatchObject({ categoryId: otherCategoryId, sortOrder: 5 });
  });

  it('responde 409 si el slug nuevo ya lo usa otro servicio', async () => {
    await createService();
    const other = await createService({ name: 'Formateo', slug: 'formateo' });
    const res = await admin.patch(`/api/admin/services/${other.id}`, { slug: 'limpieza-de-pc' });
    expect(res.status).toBe(409);
  });
});

describe('asignación masiva', () => {
  it('ignora campos que no se editan desde el panel (id, sortOrder, fechas)', async () => {
    const created = await createService();
    const res = await admin.patch(`/api/admin/services/${created.id}`, {
      id: 999,
      sortOrder: 50,
      priceUpdatedAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
      createdAt: '2000-01-01T00:00:00.000Z',
      name: 'Nombre nuevo',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: created.id,
      sortOrder: created.sortOrder,
      priceUpdatedAt: created.priceUpdatedAt,
      name: 'Nombre nuevo',
    });
  });

  it('rechaza ids fuera del rango de la base con 400 (no 500)', async () => {
    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [3_000_000_000],
      adjustment: { kind: 'PERCENT', value: 5 },
    });
    expect(res.status).toBe(400);
    const create = await admin.post(
      '/api/admin/services',
      validService({ categoryId: 3_000_000_000 }),
    );
    expect(create.status).toBe(400);
  });
});

describe('DELETE /api/admin/services/:id', () => {
  it('borra un servicio sin trabajos', async () => {
    const created = await createService();
    expect((await admin.delete(`/api/admin/services/${created.id}`)).status).toBe(204);
    expect(await prisma.service.count()).toBe(0);
  });

  it('no borra un servicio con trabajos (409): hay que archivarlo', async () => {
    const created = await createService();
    await addJob(created.id);

    const res = await admin.delete(`/api/admin/services/${created.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SERVICE_HAS_JOBS');
    expect(await prisma.service.count()).toBe(1);
  });
});

describe('PUT /api/admin/services/order', () => {
  it('reordena los servicios de una categoría', async () => {
    const a = await createService({ name: 'A', slug: 'a' });
    const b = await createService({ name: 'B', slug: 'b' });

    const res = await admin.put('/api/admin/services/order', { categoryId, ids: [b.id, a.id] });
    expect(res.status).toBe(204);

    const publicRes = await request(app).get('/api/public/services');
    expect(publicRes.body.data.map((s: { slug: string }) => s.slug)).toEqual(['b', 'a']);
  });

  it('rechaza ids que no son exactamente los de la categoría', async () => {
    const a = await createService({ name: 'A', slug: 'a' });
    await createService({ name: 'B', slug: 'b' });
    const res = await admin.put('/api/admin/services/order', { categoryId, ids: [a.id] });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/services/bulk-price', () => {
  it('aplica un porcentaje, redondea al entero y omite los "a consultar"', async () => {
    const a = await createService({ name: 'A', slug: 'a', priceAmount: 18500 });
    const b = await createService({ name: 'B', slug: 'b', priceAmount: 999.99, currency: 'USD' });
    const quote = await createService({ name: 'Q', slug: 'q', priceType: 'QUOTE' });

    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [a.id, b.id, quote.id],
      adjustment: { kind: 'PERCENT', value: 7.5 },
    });

    expect(res.status).toBe(200);
    const result = res.body.data as BulkPriceResult;
    expect(result.updated).toEqual([
      { id: a.id, name: 'A', currency: 'ARS', before: 18500, after: 19888 },
      { id: b.id, name: 'B', currency: 'USD', before: 999.99, after: 1075 },
    ]);
    expect(result.skipped).toEqual([{ id: quote.id, name: 'Q' }]);

    const stored = await prisma.service.findUniqueOrThrow({ where: { id: a.id } });
    expect(stored.priceAmount?.toNumber()).toBe(19888);
    expect(stored.priceUpdatedAt.getTime()).toBeGreaterThan(new Date(a.priceUpdatedAt).getTime());
  });

  it('suma un monto fijo', async () => {
    const a = await createService({ priceAmount: 25000 });
    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [a.id],
      adjustment: { kind: 'AMOUNT', value: -2000 },
    });
    expect(res.body.data.updated[0].after).toBe(23000);
  });

  it('no permite un monto fijo con monedas mezcladas', async () => {
    const a = await createService({ name: 'A', slug: 'a' });
    const b = await createService({ name: 'B', slug: 'b', currency: 'USD' });
    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [a.id, b.id],
      adjustment: { kind: 'AMOUNT', value: 1000 },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MIXED_CURRENCIES');
  });

  it('es todo o nada: si un resultado queda negativo no guarda ninguno', async () => {
    const a = await createService({ name: 'A', slug: 'a', priceAmount: 10000 });
    const b = await createService({ name: 'B', slug: 'b', priceAmount: 500 });
    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [a.id, b.id],
      adjustment: { kind: 'AMOUNT', value: -1000 },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_PRICE_RESULT',
      details: [{ id: b.id, name: 'B' }],
    });
    const stored = await prisma.service.findUniqueOrThrow({ where: { id: a.id } });
    expect(stored.priceAmount?.toNumber()).toBe(10000);
  });

  it.each([
    ['ajuste 0', { serviceIds: [1], adjustment: { kind: 'PERCENT', value: 0 } }],
    ['porcentaje < -99,99', { serviceIds: [1], adjustment: { kind: 'PERCENT', value: -100 } }],
    ['sin servicios', { serviceIds: [], adjustment: { kind: 'PERCENT', value: 5 } }],
    ['tipo desconocido', { serviceIds: [1], adjustment: { kind: 'OTHER', value: 5 } }],
  ])('rechaza %s (400)', async (_label, body) => {
    const res = await admin.post('/api/admin/services/bulk-price', body);
    expect(res.status).toBe(400);
  });

  it('responde 404 si algún servicio no existe', async () => {
    const a = await createService();
    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [a.id, 9999],
      adjustment: { kind: 'PERCENT', value: 5 },
    });
    expect(res.status).toBe(404);
  });

  it('responde 400 si todos los elegidos son "a consultar"', async () => {
    const quote = await createService({ priceType: 'QUOTE' });
    const res = await admin.post('/api/admin/services/bulk-price', {
      serviceIds: [quote.id],
      adjustment: { kind: 'PERCENT', value: 5 },
    });
    expect(res.body.error.code).toBe('NOTHING_TO_UPDATE');
  });
});

describe('integridad del historial', () => {
  it('cambiar el precio no modifica los trabajos ya registrados', async () => {
    const created = await createService();
    const client = await prisma.client.create({ data: { fullName: 'C', phone: '1100000000' } });
    const job = await prisma.job.create({
      data: {
        clientId: client.id,
        serviceId: created.id,
        title: 'Limpieza',
        serviceNameSnapshot: created.name,
        servicePriceSnapshot: 25000,
        amountCharged: 25000,
      },
    });

    await admin.patch(`/api/admin/services/${created.id}`, { priceAmount: 40000, name: 'Nuevo' });
    const stored = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(stored.servicePriceSnapshot?.toNumber()).toBe(25000);
    expect(stored.serviceNameSnapshot).toBe('Limpieza de PC');
  });
});
