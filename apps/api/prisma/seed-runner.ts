// Lógica del seed, separada del script (seed.ts) para poder testearla.
// Idempotente y no destructiva: nunca pisa ni recrea lo gestionado desde el panel.
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/password.js';
import { seedCategories, seedServices, seedSettings } from './seed-data.js';

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
}

export interface SeedSummary {
  settingsCreated: boolean;
  catalogCreated: boolean;
  adminCreated: boolean;
}

export async function runSeed(prisma: PrismaClient, options: SeedOptions): Promise<SeedSummary> {
  const existingSettings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { id: true },
  });
  if (!existingSettings) {
    await prisma.settings.create({ data: { id: 1, ...seedSettings } });
  }

  // El catálogo de ejemplo se carga solo si todavía no hay ninguna categoría. Así, si desde
  // el panel se borra o renombra algo, el seed no lo vuelve a crear.
  const hasCatalog = (await prisma.category.count()) > 0;
  if (!hasCatalog) {
    await prisma.$transaction(async (tx) => {
      const categoryIds = new Map<string, number>();
      for (const category of seedCategories) {
        const created = await tx.category.create({ data: category, select: { id: true } });
        categoryIds.set(category.slug, created.id);
      }
      for (const { categorySlug, ...service } of seedServices) {
        const categoryId = categoryIds.get(categorySlug);
        if (categoryId === undefined) {
          throw new Error(`El servicio "${service.slug}" referencia una categoría inexistente.`);
        }
        await tx.service.create({ data: { ...service, categoryId } });
      }
    });
  }

  // Sistema de un único admin: se crea solo si todavía no hay ninguno. Cambiar ADMIN_EMAIL
  // después no agrega un segundo admin (el email y la contraseña se cambian desde el panel).
  const existingAdmin = await prisma.adminUser.findFirst({ select: { id: true } });
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        email: options.adminEmail.trim().toLowerCase(),
        passwordHash: await hashPassword(options.adminPassword),
      },
    });
  }

  return {
    settingsCreated: !existingSettings,
    catalogCreated: !hasCatalog,
    adminCreated: !existingAdmin,
  };
}
