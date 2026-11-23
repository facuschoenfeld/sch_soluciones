import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createAuthAdminRouter } from '../auth/auth.routes.js';
import type { SessionConfig } from '../auth/session.js';
import { createCategoriesAdminRouter } from '../categories/categories.routes.js';
import { createClientsAdminRouter } from '../clients/clients.routes.js';
import { createDashboardAdminRouter } from '../dashboard/dashboard.routes.js';
import { createJobsAdminRouter } from '../jobs/jobs.routes.js';
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
  // El reloj de la app (fijo en los tests): fechas automáticas, exportaciones y métricas del mes.
  const { now } = session;

  router.use(createAuthAdminRouter({ db, session, credentialsLimiters }));
  router.use('/categories', createCategoriesAdminRouter(db, onPublicDataChange));
  router.use('/services', createServicesAdminRouter(db, onPublicDataChange));
  // El cambio de datos de contacto pide la contraseña: comparte los limitadores del login.
  router.use('/settings', createSettingsAdminRouter(db, onPublicDataChange, credentialsLimiters));
  // Mini CRM: datos privados, nunca públicos (no tocan la caché pública).
  router.use('/clients', createClientsAdminRouter(db, now));
  router.use('/jobs', createJobsAdminRouter(db, now));
  router.use('/dashboard', createDashboardAdminRouter(db, now));

  return router;
}
