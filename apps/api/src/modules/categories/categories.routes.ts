import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createCategoriesController } from './categories.controller.js';

export function createCategoriesPublicRouter(prisma: PrismaClient): Router {
  const router = Router();
  const controller = createCategoriesController(prisma);

  router.get('/', controller.listPublic);

  return router;
}
