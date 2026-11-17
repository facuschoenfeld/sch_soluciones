import { Router } from 'express';
import type { DbPinger } from '../../lib/prisma.js';
import { createHealthController } from './health.controller.js';

export function createHealthRouter(db: DbPinger): Router {
  const router = Router();
  const controller = createHealthController(db);

  router.get('/', controller.health);
  router.get('/db', controller.dbHealth);

  return router;
}
