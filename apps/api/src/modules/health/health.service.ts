import type { DbHealthResponse, HealthResponse } from '@sch/shared';
import { AppError } from '../../lib/app-error.js';
import { pingDatabase, type DbPinger } from '../../lib/prisma.js';

export function getHealth(): HealthResponse {
  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

/** Tiempo durante el cual se reutiliza el último ping exitoso. */
export const DB_HEALTH_CACHE_MS = 15_000;

/**
 * Chequeo de la base con caché en memoria del último resultado exitoso.
 * La caché limita cuántos pings llegan a la base, pero NO impide que alguien mantenga
 * Neon despierto llamando al endpoint cada pocos minutos. Pendiente (Fase 7): proteger
 * o limitar `/api/health/db` antes de producción.
 */
export function createDbHealthChecker(db: DbPinger, now: () => number = Date.now) {
  let lastOkAt: number | undefined;

  return async function getDbHealth(): Promise<DbHealthResponse> {
    const isCached = lastOkAt !== undefined && now() - lastOkAt < DB_HEALTH_CACHE_MS;
    if (!isCached) {
      try {
        await pingDatabase(db);
        lastOkAt = now();
      } catch (error) {
        lastOkAt = undefined;
        // Endpoint público: el error original solo va a los logs (como `cause`), no al cliente.
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'La base de datos no está disponible',
          undefined,
          error,
        );
      }
    }
    return { ...getHealth(), database: 'up' };
  };
}
