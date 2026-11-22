import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import { createSettingsAdminController, createSettingsController } from './settings.controller.js';

export function createSettingsPublicRouter(prisma: PrismaClient, cache: TtlCache): Router {
  const router = Router();
  const controller = createSettingsController(prisma, cache);

  router.get('/', controller.getPublic);

  return router;
}

/**
 * Aplica los limitadores de intentos fallidos solo si el body trae una contraseña: así los
 * errores de validación comunes del formulario no consumen el cupo del login, y sin contraseña
 * la API no la verifica (no hay oráculo que limitar).
 */
function whenPasswordSent(limiters: RequestHandler[]): RequestHandler[] {
  return limiters.map((limiter): RequestHandler => (req, res, next) => {
    const body: unknown = req.body;
    const sent = typeof body === 'object' && body !== null && 'currentPassword' in body;
    return sent ? limiter(req, res, next) : next();
  });
}

/** `/api/admin/settings` (protegido por requireAuth). */
export function createSettingsAdminRouter(
  prisma: PrismaClient,
  onChange: () => void,
  credentialsLimiters: RequestHandler[],
): Router {
  const router = Router();
  const controller = createSettingsAdminController(prisma, onChange);

  router.get('/', controller.get);
  router.put('/', ...whenPasswordSent(credentialsLimiters), controller.update);

  return router;
}
