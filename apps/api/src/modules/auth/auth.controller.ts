import { changePasswordSchema, loginSchema, type AuthUser, type DataResponse } from '@sch/shared';
import type { RequestHandler, Response } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/app-error.js';
import { unauthenticated } from '../../middlewares/require-auth.js';
import * as authService from './auth.service.js';
import {
  clearSessionCookie,
  setSessionCookie,
  setTrustedDeviceCookie,
  signSession,
  type SessionConfig,
} from './session.js';

/** Admin autenticado por `requireAuth` (si falta, la ruta se montó sin el middleware). */
function currentAdmin(res: Response): { id: number; email: string } {
  const admin = res.locals.admin;
  if (!admin) throw unauthenticated();
  return admin;
}

export function createAuthController(db: PrismaClient, session: SessionConfig) {
  const login: RequestHandler = async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await authService.authenticate(db, email, password);

    if (!admin) {
      // Sin el email en el log (Ley 25.326): solo el evento.
      req.log.warn({ event: 'login_failed' }, 'Intento de login fallido');
      // Mismo mensaje exista o no el email.
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

    const nowSeconds = Math.floor(session.now() / 1000);
    setSessionCookie(
      res,
      session,
      await signSession(session, {
        adminId: admin.id,
        tokenVersion: admin.tokenVersion,
        authTime: nowSeconds,
      }),
    );
    await setTrustedDeviceCookie(res, session, {
      adminId: admin.id,
      tokenVersion: admin.tokenVersion,
    });
    req.log.info({ event: 'login_succeeded' }, 'Sesión iniciada');
    const body: DataResponse<AuthUser> = { data: { email: admin.email } };
    res.json(body);
  };

  const logout: RequestHandler = (_req, res) => {
    clearSessionCookie(res, session);
    res.status(204).end();
  };

  // Consulta de estado: sin sesión responde 200 con `data: null` (no 401), así el front pregunta
  // si hay sesión sin generar errores. Las rutas de /api/admin sí responden 401.
  const me: RequestHandler = (_req, res) => {
    const admin = res.locals.admin;
    const body: DataResponse<AuthUser | null> = { data: admin ? { email: admin.email } : null };
    res.json(body);
  };

  const changePassword: RequestHandler = async (req, res) => {
    const admin = currentAdmin(res);
    const input = changePasswordSchema.parse(req.body);
    const { tokenVersion } = await authService.changePassword(db, admin.id, input);

    // Las demás sesiones quedan invalidadas; la actual sigue con un token nuevo.
    const nowSeconds = Math.floor(session.now() / 1000);
    setSessionCookie(
      res,
      session,
      await signSession(session, { adminId: admin.id, tokenVersion, authTime: nowSeconds }),
    );
    // El dispositivo actual sigue siendo de confianza; los demás pierden la exención.
    await setTrustedDeviceCookie(res, session, { adminId: admin.id, tokenVersion });
    req.log.info({ event: 'password_changed' }, 'Contraseña del admin actualizada');
    res.status(204).end();
  };

  /** Cierra todas las sesiones (incluida la actual) y revoca los dispositivos de confianza. */
  const logoutAll: RequestHandler = async (req, res) => {
    const admin = currentAdmin(res);
    await authService.revokeAllSessions(db, admin.id);
    clearSessionCookie(res, session);
    req.log.info({ event: 'sessions_revoked' }, 'Se cerraron todas las sesiones del admin');
    res.status(204).end();
  };

  return { login, logout, me, changePassword, logoutAll };
}
