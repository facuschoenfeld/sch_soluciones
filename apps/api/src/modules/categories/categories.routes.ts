import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import {
  createCategoriesAdminController,
  createCategoriesController,
} from './categories.controller.js';

export function createCategoriesPublicRouter(prisma: PrismaClient, cache: TtlCache): Router {
  const router = Router();
  const controller = createCategoriesController(prisma, cache);

  router.get('/', controller.listPublic);

  return router;
}

/** `/api/admin/categories` (protegido por requireAuth). */
export function createCategoriesAdminRouter(
  prisma: PrismaClient,
  onCatalogChange: () => void,
): Router {
  const router = Router();
  const controller = createCategoriesAdminController(prisma, onCatalogChange);

  router.get('/', controller.list);
  router.post('/', controller.create);
  // Antes de /:id para que "order" no se tome como id.
  router.put('/order', controller.reorder);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
