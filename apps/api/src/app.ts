import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { PrismaClient } from './generated/prisma/client.js';
import type { Logger } from './lib/logger.js';
import { createTtlCache } from './lib/ttl-cache.js';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createSessionResolver, requireAuth } from './middlewares/require-auth.js';
import { createTrustedDeviceResolver } from './middlewares/trusted-device.js';
import {
  DEFAULT_RATE_LIMITS,
  createRateLimiters,
  noStore,
  protectWrites,
  type RateLimitOptions,
} from './middlewares/security.js';
import { createAdminRouter, createAuthRouter } from './modules/auth/auth.routes.js';
import { createSessionConfig } from './modules/auth/session.js';
import { createCategoriesPublicRouter } from './modules/categories/categories.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createServicesPublicRouter } from './modules/services/services.routes.js';
import { createSettingsPublicRouter } from './modules/settings/settings.routes.js';

export interface AppDeps {
  db: PrismaClient;
  logger: Logger;
  /** Orígenes desde los que se aceptan escrituras en /api/auth y /api/admin (CSRF). */
  allowedOrigins: string[];
  jwtSecret: string;
  /**
   * Producción (Render): `trust proxy` = 1 (para que `req.ip` sea la IP real y no la del
   * proxy) y cookie de sesión `Secure` con prefijo `__Host-`.
   */
  isProduction: boolean;
  /** Ajustes para tests; en la app real se usan los valores por defecto. */
  options?: {
    rateLimits?: Partial<RateLimitOptions>;
    /** Vigencia de la caché de respuestas públicas (0 = sin caché). */
    publicCacheTtlMs?: number;
    now?: () => number;
  };
}

export const PUBLIC_CACHE_TTL_MS = 30_000;

/** Arma la app sin levantar el servidor, para poder testearla con Supertest. */
export function createApp({
  db,
  logger,
  allowedOrigins,
  jwtSecret,
  isProduction,
  options = {},
}: AppDeps): Express {
  const app = express();
  // Una sola capa de proxy (Render). Nunca `true`: permitiría falsificar X-Forwarded-For y
  // saltear los límites de intentos.
  if (isProduction) app.set('trust proxy', 1);

  const session = createSessionConfig({ jwtSecret, secure: isProduction, now: options.now });
  const limiters = createRateLimiters(
    { ...DEFAULT_RATE_LIMITS, ...options.rateLimits },
    { trustedDevice: createTrustedDeviceResolver(db, session) },
  );
  const resolveSession = createSessionResolver(db, session);
  const publicCache = createTtlCache(options.publicCacheTtlMs ?? PUBLIC_CACHE_TTL_MS);

  // Sin CORS: el front y la API comparten origen (proxy de Vite en desarrollo, un único
  // servicio en Render), así que no hace falta habilitar orígenes cruzados.
  app.use(helmet());
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
  app.use('/api', limiters.api);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(db));

  // API pública (sin auth): solo datos del catálogo y del negocio, nunca de clientes.
  app.use('/api/public/settings', createSettingsPublicRouter(db, publicCache));
  app.use('/api/public/categories', createCategoriesPublicRouter(db, publicCache));
  app.use('/api/public/services', createServicesPublicRouter(db, publicCache));

  // Sesión y panel. requireAuth va antes del router del panel: sin sesión, cualquier ruta de
  // /api/admin (exista o no) responde 401 y no revela qué endpoints hay. /api/auth/me no exige
  // sesión: responde `{ data: null }` sin ella (es la consulta de estado del front).
  const guarded = [noStore, protectWrites(allowedOrigins), resolveSession];
  app.use(
    '/api/auth',
    ...guarded,
    createAuthRouter({ db, session, credentialsLimiters: limiters.credentials }),
  );
  app.use(
    '/api/admin',
    ...guarded,
    requireAuth,
    createAdminRouter({ db, session, credentialsLimiters: limiters.credentials }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
