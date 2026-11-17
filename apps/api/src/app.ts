import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from './lib/logger.js';
import type { DbPinger } from './lib/prisma.js';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createHealthRouter } from './modules/health/health.routes.js';

export interface AppDeps {
  db: DbPinger;
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

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
