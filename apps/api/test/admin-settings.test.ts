import { Writable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { settingsInputSchema } from '@sch/shared';
import { seedSettings } from '../prisma/seed-data.js';
import { updateSettings } from '../src/modules/settings/settings.service.js';
import {
  ADMIN_PASSWORD,
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
    // Mismo contacto que el guardado: no hace falta la contraseña.
    await adminClient(cachedApp, cookie).put('/api/admin/settings', {
      ...validSettings,
      whatsappNumber: seedSettings.whatsappNumber,
      email: seedSettings.email,
    });

    const after = await request(cachedApp).get('/api/public/settings');
    expect(after.body.data.heroTitle).toBe('Soluciones');
  });
});

describe('PUT /api/admin/settings (datos de contacto)', () => {
  const saved = { ...validSettings, email: 'contacto@sch.test' };

  beforeEach(async () => {
    // Configuración ya guardada: el contacto actual es el de validSettings.
    await admin.put('/api/admin/settings', validSettings).expect(200);
  });

  const storedNumber = async () =>
    (await prisma.settings.findUniqueOrThrow({ where: { id: 1 } })).whatsappNumber;

  it('los demás campos se guardan sin pedir la contraseña', async () => {
    const res = await admin.put('/api/admin/settings', { ...saved, heroTitle: 'Nuevo título' });
    expect(res.status).toBe(200);
  });

  it('el mismo contacto escrito distinto (espacios, mayúsculas) no cuenta como cambio', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '+54 9 11 2233-4455',
      email: 'CONTACTO@sch.test',
    });
    expect(res.status).toBe(200);
  });

  it('cambiar el WhatsApp sin contraseña responde 403 y no guarda', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CURRENT_PASSWORD_REQUIRED');
    expect(res.body.error.details[0].path).toEqual(['currentPassword']);
    expect(await storedNumber()).toBe('5491122334455');
  });

  it('con la contraseña incorrecta responde 400 y no guarda', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      email: 'otro@sch.test',
      currentPassword: 'no-es-la-contraseña',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    const stored = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    expect(stored.email).toBe('contacto@sch.test');
  });

  it('con la contraseña correcta guarda el contacto nuevo', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
      currentPassword: ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.whatsappNumber).toBe('5491199998888');
    expect(res.body.data).not.toHaveProperty('currentPassword');
  });

  it('los intentos con contraseña incorrecta comparten el límite del login', async () => {
    const limited = createTestApp(prisma, { options: { rateLimits: { loginFailuresPerIp: 2 } } });
    const client = adminClient(limited, await loginAdmin(limited));
    const wrong = { ...saved, whatsappNumber: '5491199998888', currentPassword: 'incorrecta' };

    expect((await client.put('/api/admin/settings', wrong)).status).toBe(400);
    expect((await client.put('/api/admin/settings', wrong)).status).toBe(400);
    expect((await client.put('/api/admin/settings', wrong)).status).toBe(429);
  });

  it('los errores de validación sin contraseña no consumen ese límite', async () => {
    const limited = createTestApp(prisma, { options: { rateLimits: { loginFailuresPerIp: 1 } } });
    const client = adminClient(limited, await loginAdmin(limited));

    for (let i = 0; i < 3; i++) {
      expect((await client.put('/api/admin/settings', { ...saved, businessName: '' })).status).toBe(
        400,
      );
    }
    const ok = await client.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
      currentPassword: ADMIN_PASSWORD,
    });
    expect(ok.status).toBe(200);
  });

  it('cambiar solo el email sin contraseña responde 403 y no guarda', async () => {
    const res = await admin.put('/api/admin/settings', { ...saved, email: 'otro@sch.test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CURRENT_PASSWORD_REQUIRED');
    const stored = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    expect(stored.email).toBe('contacto@sch.test');
  });

  it('cambiar solo el email con la contraseña correcta guarda', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      email: 'Otro@SCH.test',
      currentPassword: ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('otro@sch.test');
  });

  it('borrar el email (pasa a null) también exige la contraseña', async () => {
    const res = await admin.put('/api/admin/settings', { ...saved, email: '' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CURRENT_PASSWORD_REQUIRED');
  });

  it('agregar un email cuando no había exige la contraseña', async () => {
    await admin
      .put('/api/admin/settings', { ...saved, email: null, currentPassword: ADMIN_PASSWORD })
      .expect(200);

    const res = await admin.put('/api/admin/settings', { ...saved, email: 'nuevo@sch.test' });
    expect(res.status).toBe(403);
  });

  it('con la contraseña pero sin cambiar el contacto guarda igual', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      heroTitle: 'Otro título',
      currentPassword: ADMIN_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.heroTitle).toBe('Otro título');
  });

  it('la respuesta 200 no incluye currentPassword y la contraseña no se guarda', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
      currentPassword: ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(ADMIN_PASSWORD);
    const stored = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    expect(JSON.stringify(stored)).not.toContain(ADMIN_PASSWORD);
  });

  it('la contraseña (correcta o no) y el contacto no aparecen en los logs', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const logged = createTestApp(prisma, { logger: pino({ level: 'trace' }, sink) });
    const client = adminClient(logged, await loginAdmin(logged));
    const wrong = 'contraseña-incorrecta-secreta';

    await client.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
      currentPassword: wrong,
    });
    await client.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
      currentPassword: ADMIN_PASSWORD,
    });

    const output = lines.join('');
    expect(output).toContain('/api/admin/settings');
    expect(output).not.toContain(wrong);
    expect(output).not.toContain(ADMIN_PASSWORD);
    expect(output).not.toContain('5491199998888');
  });

  it('una contraseña vacía se rechaza con 400 y no guarda', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...saved,
      whatsappNumber: '5491199998888',
      currentPassword: '',
    });
    expect(res.status).toBe(400);
    expect(await storedNumber()).toBe('5491122334455');
  });
});

describe('PUT /api/admin/settings (concurrencia y oráculo)', () => {
  beforeEach(async () => {
    await admin.put('/api/admin/settings', validSettings).expect(200);
  });

  it('un guardado sin cambio de contacto no reescribe el contacto (carrera lectura/escritura)', async () => {
    // La API leyó el contacto viejo (sin cambios → sin contraseña) y, antes del upsert, otra
    // petición guardó uno nuevo con contraseña. El upsert no debe volver al viejo.
    await prisma.settings.update({ where: { id: 1 }, data: { whatsappNumber: '5491199998888' } });
    const input = settingsInputSchema.parse({ ...validSettings, heroTitle: 'Título nuevo' });

    await updateSettings(prisma, input, { includeContact: false });

    const stored = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    expect(stored).toMatchObject({ whatsappNumber: '5491199998888', heroTitle: 'Título nuevo' });
  });

  it('con el contacto sin cambios no verifica la contraseña (no hay oráculo)', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...validSettings,
      currentPassword: 'cualquier-cosa',
    });
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/admin/settings (sin fila previa)', () => {
  it('no exige la contraseña aunque se defina el contacto por primera vez', async () => {
    expect(await prisma.settings.count()).toBe(0);
    const res = await admin.put('/api/admin/settings', validSettings);

    expect(res.status).toBe(200);
    expect(await prisma.settings.count()).toBe(1);
  });

  it('una contraseña incorrecta tampoco se verifica sin fila previa', async () => {
    const res = await admin.put('/api/admin/settings', {
      ...validSettings,
      currentPassword: 'cualquiera',
    });
    expect(res.status).toBe(200);
  });
});
