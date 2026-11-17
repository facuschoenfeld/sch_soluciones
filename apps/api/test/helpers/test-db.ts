import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createPrismaClient } from '../../src/lib/prisma.js';

loadDotenv({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true });

/**
 * URL de la base de tests. Se exige que el nombre termine en `_test` para no vaciar
 * nunca por error la base de desarrollo o la de producción.
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL en el .env (ver .env.example). Corré `pnpm db:setup` para crear la base.',
    );
  }
  const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!dbName.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL apunta a "${dbName}": el nombre debe terminar en "_test".`);
  }
  return url;
}

let client: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  client ??= createPrismaClient(getTestDatabaseUrl());
  return client;
}

/**
 * Vacía todas las tablas de la app y reinicia las secuencias.
 * Antes verifica la base a la que el cliente está conectado de verdad (no solo la URL),
 * por si alguna vez se le pasa un cliente apuntado a desarrollo.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const [row] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!row?.db.endsWith('_test')) {
    throw new Error(`resetDatabase rechazado: la base conectada es "${row?.db ?? '?'}".`);
  }
  await prisma.$executeRaw`TRUNCATE TABLE jobs, services, categories, clients, admin_users, settings RESTART IDENTITY CASCADE`;
}
