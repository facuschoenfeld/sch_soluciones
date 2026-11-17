import type { RequestHandler } from 'express';
import type { DbPinger } from '../../lib/prisma.js';
import * as healthService from './health.service.js';

export function createHealthController(db: DbPinger) {
  const getDbHealth = healthService.createDbHealthChecker(db);

  // Liviano y sin tocar la base: lo consulta el monitor externo para evitar el arranque en frío.
  const health: RequestHandler = (_req, res) => {
    res.set('Cache-Control', 'no-store').json(healthService.getHealth());
  };

  const dbHealth: RequestHandler = async (_req, res) => {
    res.set('Cache-Control', 'no-store').json(await getDbHealth());
  };

  return { health, dbHealth };
}
