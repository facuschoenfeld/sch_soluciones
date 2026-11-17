import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createServicesController } from './services.controller.js';

export function createServicesPublicRouter(prisma: PrismaClient): Router {
  const router = Router();
  const controller = createServicesController(prisma);

  router.get('/', controller.listPublic);
  router.get('/:slug', controller.getPublicBySlug);

  return router;
}
