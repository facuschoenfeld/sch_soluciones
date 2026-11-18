// Script del seed. Uso: `pnpm db:seed`. La lógica está en seed-runner.ts.
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { createPrismaClient } from '../src/lib/prisma.js';
import { runSeed } from './seed-runner.js';

const seedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_EMAIL: z
    .string()
    .trim()
    .pipe(z.email('ADMIN_EMAIL debe ser un email válido'))
    .refine(
      (value) => !value.toLowerCase().endsWith('@example.com'),
      'ADMIN_EMAIL sigue con el valor de ejemplo',
    ),
  ADMIN_PASSWORD: z
    .string()
    .min(12, 'ADMIN_PASSWORD debe tener al menos 12 caracteres')
    .refine(
      (value) => !value.startsWith('CAMBIAR'),
      'ADMIN_PASSWORD sigue con el valor de ejemplo',
    ),
});

async function main(): Promise<void> {
  loadDotenv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`Variables de entorno inválidas para el seed:\n${issues}`);
  }
  const env = parsed.data;

  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const summary = await runSeed(prisma, {
      adminEmail: env.ADMIN_EMAIL,
      adminPassword: env.ADMIN_PASSWORD,
    });
    const status = (created: boolean) => (created ? 'creado' : 'ya existía, sin cambios');
    console.log('✔ Seed aplicado');
    console.log(`  Configuración:      ${status(summary.settingsCreated)}`);
    console.log(`  Catálogo de ejemplo: ${status(summary.catalogCreated)}`);
    console.log(
      summary.adminCreated
        ? `  Admin: creado (${env.ADMIN_EMAIL.toLowerCase()})`
        : '  Admin: ya existía (no se modificaron su email ni su contraseña)',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('✖ Seed falló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
