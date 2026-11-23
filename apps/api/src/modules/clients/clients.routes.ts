import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createClientsAdminController } from './clients.controller.js';

/** `/api/admin/clients` (protegido por requireAuth). */
export function createClientsAdminRouter(prisma: PrismaClient, now: () => number): Router {
  const router = Router();
  const controller = createClientsAdminController(prisma, now);

  router.get('/', controller.list);
  router.post('/', controller.create);
  // Rutas fijas antes de /:id.
  router.get('/export', controller.exportList);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
