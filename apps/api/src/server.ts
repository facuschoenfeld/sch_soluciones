import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { connectWithRetry, createPrismaClient } from './lib/prisma.js';

const env = loadEnv();
const logger = createLogger(env);
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({ db: prisma, logger, corsOrigins: env.CORS_ORIGIN });

const server = app.listen(env.PORT, (error?: Error) => {
  if (error) {
    logger.fatal({ err: error }, 'No se pudo iniciar el servidor');
    process.exit(1);
  }
  logger.info(`API escuchando en http://localhost:${env.PORT}`);
});

// Se levanta el servidor antes de conectar a la base: así /api/health responde
// aunque Neon todavía esté despertando.
void connectWithRetry(prisma, { logger });

function shutdown(signal: string): void {
  logger.info({ signal }, 'Cerrando servidor');
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Corte forzado si quedan conexiones colgadas.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
