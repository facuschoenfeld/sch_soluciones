import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createJobsAdminController } from './jobs.controller.js';

/** `/api/admin/jobs` (protegido por requireAuth). */
export function createJobsAdminRouter(prisma: PrismaClient, now: () => number): Router {
  const router = Router();
  const controller = createJobsAdminController(prisma, now);

  router.get('/', controller.list);
  router.post('/', controller.create);
  // Rutas fijas antes de /:id.
  router.get('/export', controller.exportList);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
