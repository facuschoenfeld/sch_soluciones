import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import { createCategoriesController } from './categories.controller.js';

export function createCategoriesPublicRouter(prisma: PrismaClient, cache: TtlCache): Router {
  const router = Router();
  const controller = createCategoriesController(prisma, cache);

  router.get('/', controller.listPublic);

  return router;
}
