import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import { createSettingsAdminController, createSettingsController } from './settings.controller.js';

export function createSettingsPublicRouter(prisma: PrismaClient, cache: TtlCache): Router {
  const router = Router();
  const controller = createSettingsController(prisma, cache);

  router.get('/', controller.getPublic);

  return router;
}

/** `/api/admin/settings` (protegido por requireAuth). */
export function createSettingsAdminRouter(prisma: PrismaClient, onChange: () => void): Router {
  const router = Router();
  const controller = createSettingsAdminController(prisma, onChange);

  router.get('/', controller.get);
  router.put('/', controller.update);

  return router;
}
