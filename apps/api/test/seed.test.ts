import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../prisma/seed-runner.js';
import { seedCategories, seedServices } from '../prisma/seed-data.js';
import { verifyPassword } from '../src/lib/password.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const options = { adminEmail: 'Admin@Example.com', adminPassword: 'una-contraseña-segura' };

describe('runSeed', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('carga settings, categorías, servicios y el admin', async () => {
    const summary = await runSeed(prisma, options);

    expect(summary).toEqual({ settingsCreated: true, catalogCreated: true, adminCreated: true });
    expect(await prisma.settings.count()).toBe(1);
    expect(await prisma.category.count()).toBe(seedCategories.length);
    expect(await prisma.service.count()).toBe(seedServices.length);
    expect(seedServices.length).toBeGreaterThanOrEqual(10);
  });

  it('no recrea servicios o categorías borrados o renombrados desde el panel', async () => {
    await runSeed(prisma, options);
    await prisma.service.delete({ where: { slug: 'tienda-online' } });
    await prisma.category.update({
      where: { slug: 'reparacion' },
      data: { slug: 'reparaciones' },
    });

    const second = await runSeed(prisma, options);

    expect(second.catalogCreated).toBe(false);
    expect(await prisma.service.findUnique({ where: { slug: 'tienda-online' } })).toBeNull();
    expect(await prisma.category.findUnique({ where: { slug: 'reparacion' } })).toBeNull();
    expect(await prisma.service.count()).toBe(seedServices.length - 1);
  });

  it('incluye servicios de los tres tipos de precio y en ambas monedas', async () => {
    await runSeed(prisma, options);
    const services = await prisma.service.findMany();

    expect(new Set(services.map((s) => s.priceType))).toEqual(new Set(['FIXED', 'FROM', 'QUOTE']));
    expect(new Set(services.map((s) => s.currency))).toEqual(new Set(['ARS', 'USD']));
  });

  it('es idempotente: correrlo dos veces no duplica nada', async () => {
    await runSeed(prisma, options);
    const second = await runSeed(prisma, options);

    expect(second).toEqual({ settingsCreated: false, catalogCreated: false, adminCreated: false });
    expect(await prisma.category.count()).toBe(seedCategories.length);
    expect(await prisma.service.count()).toBe(seedServices.length);
    expect(await prisma.adminUser.count()).toBe(1);
  });

  it('no pisa cambios hechos desde el panel ni la contraseña del admin', async () => {
    await runSeed(prisma, options);
    await prisma.service.update({
      where: { slug: 'instalacion-de-windows' },
      data: { priceAmount: 99999 },
    });
    await prisma.settings.update({ where: { id: 1 }, data: { businessName: 'Mi negocio' } });

    await runSeed(prisma, { ...options, adminPassword: 'otra-contraseña-distinta' });

    const service = await prisma.service.findUniqueOrThrow({
      where: { slug: 'instalacion-de-windows' },
    });
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });
    expect(service.priceAmount?.toNumber()).toBe(99999);
    expect(settings.businessName).toBe('Mi negocio');
    expect(await verifyPassword(admin.passwordHash, options.adminPassword)).toBe(true);
  });

  it('no crea un segundo admin si cambia ADMIN_EMAIL', async () => {
    await runSeed(prisma, options);
    const second = await runSeed(prisma, { ...options, adminEmail: 'nuevo@example.com' });

    expect(second.adminCreated).toBe(false);
    expect(await prisma.adminUser.count()).toBe(1);
  });

  it('guarda el email en minúsculas y la contraseña hasheada con argon2id', async () => {
    await runSeed(prisma, options);
    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });

    expect(admin.passwordHash).toMatch(/^\$argon2id\$/);
    expect(admin.passwordHash).not.toContain(options.adminPassword);
    expect(await verifyPassword(admin.passwordHash, options.adminPassword)).toBe(true);
    expect(await verifyPassword(admin.passwordHash, 'incorrecta')).toBe(false);
  });

  it('respeta la restricción de precio: los QUOTE no tienen monto', async () => {
    await runSeed(prisma, options);
    const quotes = await prisma.service.findMany({ where: { priceType: 'QUOTE' } });
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.every((s) => s.priceAmount === null)).toBe(true);
  });
});
