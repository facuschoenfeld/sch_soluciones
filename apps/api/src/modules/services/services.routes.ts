import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import { createServicesController } from './services.controller.js';

export function createServicesPublicRouter(prisma: PrismaClient, cache: TtlCache): Router {
  const router = Router();
  const controller = createServicesController(prisma, cache);

  router.get('/', controller.listPublic);
  router.get('/:slug', controller.getPublicBySlug);

  return router;
}
