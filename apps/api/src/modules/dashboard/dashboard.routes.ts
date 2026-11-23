import type { AdminDashboard, DataResponse } from '@sch/shared';
import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { getDashboard } from './dashboard.service.js';

/** `/api/admin/dashboard` (protegido por requireAuth). */
export function createDashboardAdminRouter(prisma: PrismaClient, now: () => number): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const body: DataResponse<AdminDashboard> = {
      data: await getDashboard(prisma, new Date(now())),
    };
    res.json(body);
  });

  return router;
}
