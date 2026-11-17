import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createSettingsController } from './settings.controller.js';

export function createSettingsPublicRouter(prisma: PrismaClient): Router {
  const router = Router();
  const controller = createSettingsController(prisma);

  router.get('/', controller.getPublic);

  return router;
}
