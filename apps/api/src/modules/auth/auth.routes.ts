import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createAuthController } from './auth.controller.js';
import { getDummyHash } from './auth.service.js';
import type { SessionConfig } from './session.js';

interface AuthRouterDeps {
  db: PrismaClient;
  session: SessionConfig;
  /** Limitadores de intentos fallidos: van antes de Zod y de argon2 (caro en CPU y memoria). */
  credentialsLimiters: RequestHandler[];
}

/** `/api/auth`: login, logout y sesión actual. */
export function createAuthRouter({ db, session, credentialsLimiters }: AuthRouterDeps): Router {
  const router = Router();
  const controller = createAuthController(db, session);
  // Se calcula al arrancar para que el primer login con un email inexistente no tarde el doble.
  getDummyHash().catch(() => undefined);

  router.post('/login', ...credentialsLimiters, controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', controller.me);

  return router;
}

/** Rutas de la cuenta dentro de `/api/admin` (ya protegido por requireAuth). */
export function createAuthAdminRouter({
  db,
  session,
  credentialsLimiters,
}: AuthRouterDeps): Router {
  const router = Router();
  const controller = createAuthController(db, session);

  // La contraseña actual funciona como oráculo: mismo límite de intentos que el login.
  router.post('/password', ...credentialsLimiters, controller.changePassword);
  router.post('/logout-all', controller.logoutAll);

  return router;
}
