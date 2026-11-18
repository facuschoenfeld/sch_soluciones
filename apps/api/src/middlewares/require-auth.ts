import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../lib/app-error.js';
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
  signSession,
  verifySession,
  type SessionConfig,
} from '../modules/auth/session.js';

export function unauthenticated(): AppError {
  return new AppError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar');
}

/**
 * Lee la sesión y deja el admin en `res.locals.admin` (o nada, si no hay sesión válida).
 * Además de la firma y el vencimiento del JWT, compara su `tv` con el `tokenVersion` actual:
 * cambiar la contraseña invalida las sesiones anteriores y un admin borrado pierde el acceso.
 * Con un único admin, la consulta es barata.
 */
export function createSessionResolver(db: PrismaClient, session: SessionConfig): RequestHandler {
  return async (req, res, next) => {
    const token = readSessionCookie(req, session);
    if (!token) {
      next();
      return;
    }

    const claims = await verifySession(session, token);
    if (!claims) {
      clearSessionCookie(res, session);
      next();
      return;
    }

    let admin: { id: number; email: string; tokenVersion: number } | null;
    try {
      admin = await db.adminUser.findUnique({
        where: { id: claims.adminId },
        select: { id: true, email: true, tokenVersion: true },
      });
    } catch (error) {
      // Base caída o despertando: no es un problema de sesión (no se borra la cookie).
      throw new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'La base de datos no está disponible',
        undefined,
        error,
      );
    }

    if (!admin || admin.tokenVersion !== claims.tokenVersion) {
      clearSessionCookie(res, session);
      next();
      return;
    }

    // Renovación deslizante: pasada la mitad de la duración se emite un token nuevo (con el
    // mismo auth_time, así el tope absoluto desde el login se mantiene).
    const remaining = claims.expiresAt - Math.floor(session.now() / 1000);
    if (remaining < session.ttlSeconds / 2) {
      const renewed = await signSession(session, {
        adminId: admin.id,
        tokenVersion: admin.tokenVersion,
        authTime: claims.authTime,
      });
      if (renewed.expiresAt > claims.expiresAt) setSessionCookie(res, session, renewed);
    }

    res.locals.admin = { id: admin.id, email: admin.email };
    next();
  };
}

/** Después de `createSessionResolver`: sin sesión válida responde 401. */
export const requireAuth: RequestHandler = (_req, res, next) => {
  if (!res.locals.admin) throw unauthenticated();
  next();
};
