import type { Express } from 'express';
import { createApp, type AppDeps } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createLogger } from '../../src/lib/logger.js';

export const TEST_ORIGIN = 'http://localhost:5173';
export const TEST_JWT_SECRET = 'secreto-de-tests-con-al-menos-cuarenta-y-tres-caracteres';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

/**
 * App para tests: sin caché pública (cada test ve lo que acaba de escribir en la base) y con
 * los límites de intentos por defecto, salvo que el test los cambie.
 */
export function createTestApp(db: PrismaClient, overrides: Partial<AppDeps> = {}): Express {
  return createApp({
    db,
    logger,
    allowedOrigins: [TEST_ORIGIN],
    jwtSecret: TEST_JWT_SECRET,
    isProduction: false,
    ...overrides,
    options: { publicCacheTtlMs: 0, ...overrides.options },
  });
}
