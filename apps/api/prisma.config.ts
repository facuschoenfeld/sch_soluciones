import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// El `.env` vive en la raíz del monorepo. En producción no existe y las variables vienen del entorno.
loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // La condición permite importar @sch/shared desde su código fuente, sin compilarlo.
    seed: 'tsx --conditions=@sch/source prisma/seed.ts',
  },
  datasource: {
    // Las migraciones usan la conexión directa (en Neon, la no-pooled).
    // `prisma generate` no necesita conexión, por eso se tolera que falte.
    // `||` (no `??`) para que una variable definida pero vacía también use el fallback.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
