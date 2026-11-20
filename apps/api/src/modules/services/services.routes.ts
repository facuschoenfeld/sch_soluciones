import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import { createServicesAdminController, createServicesController } from './services.controller.js';

export function createServicesPublicRouter(prisma: PrismaClient, cache: TtlCache): Router {
  const router = Router();
  const controller = createServicesController(prisma, cache);

  router.get('/', controller.listPublic);
  router.get('/:slug', controller.getPublicBySlug);

  return router;
}

/** `/api/admin/services` (protegido por requireAuth). */
export function createServicesAdminRouter(
  prisma: PrismaClient,
  onCatalogChange: () => void,
): Router {
  const router = Router();
  const controller = createServicesAdminController(prisma, onCatalogChange);

  router.get('/', controller.list);
  router.post('/', controller.create);
  // Rutas fijas antes de /:id.
  router.put('/order', controller.reorder);
  router.post('/bulk-price', controller.bulkPrice);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
