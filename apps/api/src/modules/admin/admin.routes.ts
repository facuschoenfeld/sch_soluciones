import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createAuthAdminRouter } from '../auth/auth.routes.js';
import type { SessionConfig } from '../auth/session.js';
import { createCategoriesAdminRouter } from '../categories/categories.routes.js';
import { createServicesAdminRouter } from '../services/services.routes.js';
import { createSettingsAdminRouter } from '../settings/settings.routes.js';

interface AdminRouterDeps {
  db: PrismaClient;
  session: SessionConfig;
  credentialsLimiters: RequestHandler[];
  /** Se llama después de cada escritura del catálogo o de la configuración. */
  onPublicDataChange: () => void;
}

/** `/api/admin/*`. Se monta detrás de requireAuth: todo lo de acá exige sesión. */
export function createAdminRouter({
  db,
  session,
  credentialsLimiters,
  onPublicDataChange,
}: AdminRouterDeps): Router {
  const router = Router();

  router.use(createAuthAdminRouter({ db, session, credentialsLimiters }));
  router.use('/categories', createCategoriesAdminRouter(db, onPublicDataChange));
  router.use('/services', createServicesAdminRouter(db, onPublicDataChange));
  // El cambio de datos de contacto pide la contraseña: comparte los limitadores del login.
  router.use('/settings', createSettingsAdminRouter(db, onPublicDataChange, credentialsLimiters));

  return router;
}
