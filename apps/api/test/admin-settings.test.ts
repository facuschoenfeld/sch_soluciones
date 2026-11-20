import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedSettings } from '../prisma/seed-data.js';
import {
  adminClient,
  loginAdmin,
  loginAsAdmin,
  type AdminClient,
} from './helpers/admin-session.js';
import { createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const app = createTestApp(prisma);
let admin: AdminClient;

const validSettings = {
  businessName: 'SCH Soluciones',
  tagline: 'Desarrollo y servicio técnico',
  whatsappNumber: '5491122334455',
  bookingWhatsappTemplate: 'Quiero reservar {{servicio}}',
  inquiryWhatsappTemplate: '',
  generalWhatsappTemplate: 'Hola {{negocio}}',
  heroTitle: 'Soluciones',
  heroSubtitle: null,
  aboutText: 'Trabajo de forma independiente.\n\nAtiendo en zona norte.',
  businessHours: 'Lunes a viernes',
  serviceArea: 'Zona norte',
  instagramUrl: 'https://instagram.com/sch',
  githubUrl: '',
  linkedinUrl: null,
  email: ' Contacto@SCH.test ',
};

beforeEach(async () => {
  await resetDatabase(prisma);
  admin = adminClient(app, await loginAsAdmin(app, prisma));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/admin/settings', () => {
  it('devuelve la configuración guardada', async () => {
    await prisma.settings.create({ data: { id: 1, ...seedSettings } });
    const res = await admin.get('/api/admin/settings');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ...seedSettings, aboutText: null });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/admin/settings')).status).toBe(401);
  });
});

describe('PUT /api/admin/settings', () => {
  it('guarda y normaliza (vacíos → null, email en minúsculas) aunque no exista la fila', async () => {
    const res = await admin.put('/api/admin/settings', validSettings);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ...validSettings,
      githubUrl: null,
      email: 'contacto@sch.test',
    });
    const publicRes = await request(app).get('/api/public/settings');
    expect(publicRes.body.data.aboutText).toBe(validSettings.aboutText);
  });

  it('ignora campos que no son de la configuración (id, updatedAt, tokenVersion)', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...validSettings,
      id: 2,
      updatedAt: '2000-01-01T00:00:00.000Z',
      tokenVersion: 99,
    });
    expect(res.status).toBe(200);
    expect(await prisma.settings.count()).toBe(1);
    expect(
      (await prisma.settings.findUniqueOrThrow({ where: { id: 1 } })).updatedAt.getFullYear(),
    ).not.toBe(2000);
    expect((await prisma.adminUser.findFirstOrThrow()).tokenVersion).toBe(0);
  });

  it('acepta el número con espacios, guiones y "+" y guarda solo los dígitos', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...validSettings,
      whatsappNumber: '+54 9 11 2233-4455',
    });
    expect(res.body.data.whatsappNumber).toBe('5491122334455');
  });

  it.each([
    ['número con letras', { whatsappNumber: '54911abc' }],
    ['número corto', { whatsappNumber: '1234' }],
    ['link http (no https)', { instagramUrl: 'http://instagram.com/sch' }],
    ['link javascript:', { linkedinUrl: 'javascript:alert(1)' }],
    ['email inválido', { email: 'no-es-un-email' }],
    ['nombre vacío', { businessName: '' }],
    ['plantilla demasiado larga', { generalWhatsappTemplate: 'x'.repeat(1001) }],
  ])('rechaza %s con error en el campo', async (_label, overrides) => {
    const res = await admin.put('/api/admin/settings', { ...validSettings, ...overrides });
    expect(res.status).toBe(400);
    const field = Object.keys(overrides)[0];
    expect(res.body.error.details.map((d: { path: string[] }) => d.path[0])).toContain(field);
  });

  it('un cambio se ve en el sitio aunque la respuesta pública estuviera en caché', async () => {
    const cachedApp = createTestApp(prisma, { options: { publicCacheTtlMs: 60_000 } });
    await prisma.settings.create({ data: { id: 1, ...seedSettings } });
    const before = await request(cachedApp).get('/api/public/settings');
    expect(before.body.data.heroTitle).toBe(seedSettings.heroTitle);

    const cookie = await loginAdmin(cachedApp);
    await adminClient(cachedApp, cookie).put('/api/admin/settings', validSettings);

    const after = await request(cachedApp).get('/api/public/settings');
    expect(after.body.data.heroTitle).toBe('Soluciones');
  });
});
