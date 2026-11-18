import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_GENERAL_WHATSAPP_TEMPLATE, type PublicServiceSummary } from '@sch/shared';
import { runSeed } from '../prisma/seed-runner.js';
import { createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const app = createTestApp(prisma);

beforeAll(async () => {
  await resetDatabase(prisma);
  await runSeed(prisma, { adminEmail: 'admin@example.com', adminPassword: 'contraseña-de-test' });

  // Casos que no deben aparecer en la API pública.
  const hiddenCategory = await prisma.category.create({
    data: { name: 'Oculta', slug: 'categoria-oculta', line: 'TECH_SUPPORT', isActive: false },
  });
  const visibleCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: 'reparacion' },
  });
  await prisma.service.createMany({
    data: [
      {
        categoryId: visibleCategory.id,
        name: 'Servicio archivado',
        slug: 'servicio-archivado',
        shortDescription: 'No debe verse',
        priceType: 'QUOTE',
        isActive: false,
      },
      {
        categoryId: hiddenCategory.id,
        name: 'Servicio en categoría oculta',
        slug: 'servicio-en-categoria-oculta',
        shortDescription: 'Tampoco debe verse',
        priceType: 'QUOTE',
      },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/public/settings', () => {
  it('devuelve los datos públicos del negocio con ambas plantillas de WhatsApp', async () => {
    const res = await request(app).get('/api/public/settings');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      businessName: 'SCH Soluciones',
      whatsappNumber: '5491100000000',
    });
    expect(res.body.data.bookingWhatsappTemplate).toContain('{{servicio}}');
    expect(res.body.data.inquiryWhatsappTemplate).toContain('{{servicio}}');
    expect(res.body.data.generalWhatsappTemplate).toBe(DEFAULT_GENERAL_WHATSAPP_TEMPLATE);
    expect(res.body.data).not.toHaveProperty('id');
    expect(res.body.data).not.toHaveProperty('updatedAt');
  });
});

describe('GET /api/public/categories', () => {
  it('devuelve solo categorías activas ordenadas por sortOrder', async () => {
    const res = await request(app).get('/api/public/categories');

    expect(res.status).toBe(200);
    const slugs = res.body.data.map((c: { slug: string }) => c.slug);
    expect(slugs).toEqual([
      'desarrollo-web',
      'aplicaciones-de-escritorio',
      'mantenimiento-de-pc',
      'reparacion',
      'instalacion-de-software',
    ]);
    expect(res.body.data[0]).toEqual({
      slug: 'desarrollo-web',
      name: 'Desarrollo web',
      description: expect.any(String),
      icon: 'globe',
      line: 'DEVELOPMENT',
    });
  });
});

describe('GET /api/public/services', () => {
  async function list(query = ''): Promise<PublicServiceSummary[]> {
    const res = await request(app).get(`/api/public/services${query}`);
    expect(res.status).toBe(200);
    return res.body.data as PublicServiceSummary[];
  }

  it('no expone servicios archivados ni de categorías inactivas', async () => {
    const slugs = (await list()).map((s) => s.slug);

    expect(slugs).not.toContain('servicio-archivado');
    expect(slugs).not.toContain('servicio-en-categoria-oculta');
    expect(slugs).toHaveLength(11);
  });

  it('ordena por categoría y luego por sortOrder del servicio', async () => {
    const services = await list();

    expect(services.slice(0, 3).map((s) => s.slug)).toEqual([
      'landing-page',
      'sitio-web-institucional',
      'tienda-online',
    ]);
    expect(services.at(-1)?.slug).toBe('formateo-con-respaldo');
  });

  it('devuelve los montos como número y null en los QUOTE, sin campos internos', async () => {
    const services = await list();
    const windows = services.find((s) => s.slug === 'instalacion-de-windows');
    const quote = services.find((s) => s.slug === 'tienda-online');

    expect(windows).toMatchObject({
      priceType: 'FIXED',
      priceAmount: 30000,
      currency: 'ARS',
      priceUnit: 'por equipo',
      isFeatured: true,
      category: { slug: 'instalacion-de-software', line: 'TECH_SUPPORT' },
    });
    expect(quote?.priceAmount).toBeNull();
    expect(windows).not.toHaveProperty('id');
    expect(windows).not.toHaveProperty('isActive');
    expect(windows).not.toHaveProperty('description');
  });

  it('filtra por categoría', async () => {
    const services = await list('?category=reparacion');

    expect(services.map((s) => s.slug)).toEqual([
      'diagnostico-de-fallas',
      'reparacion-de-pc-y-notebooks',
    ]);
  });

  it('devuelve lista vacía para una categoría inexistente o inactiva', async () => {
    expect(await list('?category=no-existe')).toEqual([]);
    expect(await list('?category=categoria-oculta')).toEqual([]);
  });

  it('busca por nombre o descripción corta sin distinguir mayúsculas', async () => {
    expect((await list('?q=WINDOWS')).map((s) => s.slug)).toEqual(['instalacion-de-windows']);
    expect((await list('?q=pasta%20t%C3%A9rmica')).map((s) => s.slug)).toEqual([
      'limpieza-y-mantenimiento-preventivo',
    ]);
  });

  it('combina categoría y búsqueda', async () => {
    expect(await list('?category=desarrollo-web&q=windows')).toEqual([]);
  });

  it('ignora parámetros vacíos', async () => {
    expect(await list('?category=&q=%20%20')).toHaveLength(11);
  });

  it('responde 400 ante parámetros inválidos', async () => {
    const badSlug = await request(app).get('/api/public/services?category=Mal%20Slug!');
    const longQuery = await request(app).get(`/api/public/services?q=${'a'.repeat(101)}`);
    const repeated = await request(app).get('/api/public/services?q=a&q=b');

    for (const res of [badSlug, longQuery, repeated]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('no permite inyección SQL a través de la búsqueda', async () => {
    expect(await list(`?q=${encodeURIComponent("' OR 1=1 --")}`)).toEqual([]);
  });
});

describe('GET /api/public/services/:slug', () => {
  it('devuelve el detalle con la descripción en markdown', async () => {
    const res = await request(app).get('/api/public/services/diagnostico-de-fallas');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      slug: 'diagnostico-de-fallas',
      priceAmount: 10000,
      category: { slug: 'reparacion' },
    });
    expect(res.body.data.description).toContain('**');
  });

  it.each([
    ['inexistente', 'no-existe'],
    ['archivado', 'servicio-archivado'],
    ['de una categoría inactiva', 'servicio-en-categoria-oculta'],
    ['con slug mal formado', 'Mal_Slug'],
  ])('responde 404 para un servicio %s', async (_caso, slug) => {
    const res = await request(app).get(`/api/public/services/${slug}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
  });
});

describe('GET /api/public/settings sin configuración cargada', () => {
  it('responde 404 SETTINGS_NOT_FOUND', async () => {
    await prisma.settings.deleteMany();
    const res = await request(app).get('/api/public/settings');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SETTINGS_NOT_FOUND');
  });
});
