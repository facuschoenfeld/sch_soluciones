import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { PrismaClient } from './generated/prisma/client.js';
import type { Logger } from './lib/logger.js';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createCategoriesPublicRouter } from './modules/categories/categories.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createServicesPublicRouter } from './modules/services/services.routes.js';
import { createSettingsPublicRouter } from './modules/settings/settings.routes.js';

export interface AppDeps {
  db: PrismaClient;
  logger: Logger;
  corsOrigins: string[];
}

/** Arma la app sin levantar el servidor, para poder testearla con Supertest. */
export function createApp({ db, logger, corsOrigins }: AppDeps): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(
    pinoHttp({
      logger,
      // El monitor externo consulta /api/health cada pocos minutos: no ensuciar los logs.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // Solo lo mínimo: sin headers, query ni body (pueden contener datos personales).
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res) => {
        // 503 = dependencia caída (ej. base suspendida): esperado, ya lo detalla el error handler.
        if (res.statusCode === 503) return 'warn';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(db));

  // API pública (sin auth): solo datos del catálogo y del negocio, nunca de clientes.
  app.use('/api/public/settings', createSettingsPublicRouter(db));
  app.use('/api/public/categories', createCategoriesPublicRouter(db));
  app.use('/api/public/services', createServicesPublicRouter(db));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
