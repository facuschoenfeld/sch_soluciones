import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminCategory } from '@sch/shared';
import { adminClient, loginAsAdmin, type AdminClient } from './helpers/admin-session.js';
import { createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const app = createTestApp(prisma);
let admin: AdminClient;
let cookie: string;

const validCategory = {
  name: 'Redes',
  slug: 'redes',
  description: 'Instalación de routers y cableado',
  icon: 'globe',
  line: 'TECH_SUPPORT',
  isActive: true,
};

beforeEach(async () => {
  await resetDatabase(prisma);
  cookie = await loginAsAdmin(app, prisma);
  admin = adminClient(app, cookie);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createCategory(overrides: Partial<typeof validCategory> = {}) {
  const res = await admin.post('/api/admin/categories', { ...validCategory, ...overrides });
  expect(res.status).toBe(201);
  return res.body.data as AdminCategory;
}

describe('acceso', () => {
  it('sin sesión responde 401', async () => {
    const res = await request(app).get('/api/admin/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/categories', () => {
  it('crea la categoría al final del orden', async () => {
    const first = await createCategory();
    const second = await createCategory({ name: 'Software', slug: 'software' });

    expect(first).toMatchObject({ ...validCategory, sortOrder: 0, servicesCount: 0 });
    expect(second.sortOrder).toBe(1);
  });

  it('guarda como null los textos opcionales vacíos', async () => {
    const created = await createCategory({ description: '   ', icon: '' });
    expect(created).toMatchObject({ description: null, icon: null });
  });

  it('rechaza datos inválidos con errores por campo', async () => {
    const res = await admin.post('/api/admin/categories', {
      ...validCategory,
      name: '',
      slug: 'Con Espacios',
      line: 'OTRA',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = (res.body.error.details as { path: string[] }[]).map((d) => d.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['name', 'slug', 'line']));
  });

  it('responde 409 con el error en el campo slug si ya existe', async () => {
    await createCategory();
    const res = await admin.post('/api/admin/categories', validCategory);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
    expect(res.body.error.details).toEqual([{ path: ['slug'], message: expect.any(String) }]);
  });
});

describe('PATCH /api/admin/categories/:id', () => {
  it('edita solo los campos enviados', async () => {
    const created = await createCategory();
    const res = await admin.patch(`/api/admin/categories/${created.id}`, { isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ...validCategory, isActive: false });
  });

  it('responde 404 si no existe o el id es inválido', async () => {
    expect((await admin.patch('/api/admin/categories/999', { name: 'X' })).status).toBe(404);
    expect((await admin.patch('/api/admin/categories/abc', { name: 'X' })).status).toBe(404);
  });

  it('una categoría desactivada desaparece del sitio público', async () => {
    const created = await createCategory();
    await admin.patch(`/api/admin/categories/${created.id}`, { isActive: false });

    const res = await request(app).get('/api/public/categories');
    expect(res.body.data).toEqual([]);
  });
});

describe('asignación masiva', () => {
  it('ignora id y sortOrder en el PATCH', async () => {
    const created = await createCategory();
    const res = await admin.patch(`/api/admin/categories/${created.id}`, {
      id: 999,
      sortOrder: 40,
      name: 'Redes y Wi-Fi',
    });
    expect(res.body.data).toMatchObject({ id: created.id, sortOrder: 0, name: 'Redes y Wi-Fi' });
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  it('borra una categoría sin servicios', async () => {
    const created = await createCategory();
    const res = await admin.delete(`/api/admin/categories/${created.id}`);

    expect(res.status).toBe(204);
    expect(await prisma.category.count()).toBe(0);
  });

  it('no borra una categoría con servicios (409)', async () => {
    const created = await createCategory();
    await prisma.service.create({
      data: {
        categoryId: created.id,
        name: 'Cableado',
        slug: 'cableado',
        shortDescription: 'x',
        priceType: 'QUOTE',
        isActive: false,
      },
    });

    const res = await admin.delete(`/api/admin/categories/${created.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_HAS_SERVICES');
    expect(await prisma.category.count()).toBe(1);
  });

  it('responde 404 si no existe', async () => {
    expect((await admin.delete('/api/admin/categories/999')).status).toBe(404);
  });
});

describe('PUT /api/admin/categories/order', () => {
  it('guarda el orden nuevo y el listado lo respeta', async () => {
    const a = await createCategory({ name: 'A', slug: 'a' });
    const b = await createCategory({ name: 'B', slug: 'b' });
    const c = await createCategory({ name: 'C', slug: 'c' });

    const res = await admin.put('/api/admin/categories/order', { ids: [c.id, a.id, b.id] });
    expect(res.status).toBe(204);

    const list = await admin.get('/api/admin/categories');
    expect((list.body.data as AdminCategory[]).map((cat) => cat.slug)).toEqual(['c', 'a', 'b']);
  });

  it('rechaza una lista incompleta (409) o con repetidos (400)', async () => {
    const a = await createCategory({ name: 'A', slug: 'a' });
    const b = await createCategory({ name: 'B', slug: 'b' });

    const incomplete = await admin.put('/api/admin/categories/order', { ids: [a.id] });
    expect(incomplete.status).toBe(409);
    expect(incomplete.body.error.code).toBe('ORDER_MISMATCH');

    const repeated = await admin.put('/api/admin/categories/order', { ids: [a.id, a.id] });
    expect(repeated.status).toBe(400);

    const list = await admin.get('/api/admin/categories');
    expect((list.body.data as AdminCategory[]).map((cat) => cat.id)).toEqual([a.id, b.id]);
  });
});

describe('caché pública', () => {
  it('una escritura del panel invalida la caché del sitio', async () => {
    const cachedApp = createTestApp(prisma, { options: { publicCacheTtlMs: 60_000 } });
    // La sesión es un JWT con el mismo secreto: sirve también en esta otra instancia.
    const cachedAdmin = adminClient(cachedApp, cookie);
    const created = await createCategory();

    const before = await request(cachedApp).get('/api/public/categories');
    expect(before.body.data).toHaveLength(1);

    await cachedAdmin.patch(`/api/admin/categories/${created.id}`, { name: 'Redes y Wi-Fi' });
    const after = await request(cachedApp).get('/api/public/categories');
    expect(after.body.data[0].name).toBe('Redes y Wi-Fi');
  });
});
