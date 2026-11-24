import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from '@/components/admin/admin-layout';
import { RequireAuth } from '@/components/admin/require-auth';
import { Toaster } from '@/components/admin/toaster';
import { SlowLoadingNotice } from '@/components/feedback/slow-loading-notice';
import { IconAnimationContext } from '@/components/icons/icon-animation-context';
import { CategoriesPage } from '@/pages/admin/categories-page';
import { ClientDetailPage } from '@/pages/admin/client-detail-page';
import { ClientFormPage } from '@/pages/admin/client-form-page';
import { ClientsPage } from '@/pages/admin/clients-page';
import { DashboardPage } from '@/pages/admin/dashboard-page';
import { JobFormPage } from '@/pages/admin/job-form-page';
import { JobsPage } from '@/pages/admin/jobs-page';
import { LoginPage } from '@/pages/admin/login-page';
import { ServiceFormPage } from '@/pages/admin/service-form-page';
import { ServicesPage } from '@/pages/admin/services-page';
import { SettingsPage } from '@/pages/admin/settings-page';

/** El panel no debe aparecer en buscadores (Fase 7: además `X-Robots-Tag` desde el servidor). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/**
 * Panel de administración (/admin/*). Se carga aparte del sitio público (code-splitting): el
 * visitante nunca descarga el código del panel ni los formularios con Zod.
 */
export default function AdminApp() {
  useNoIndex();

  return (
    // Íconos estáticos en el panel (los animados son solo del sitio público).
    <IconAnimationContext value={false}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="servicios" element={<ServicesPage />} />
            <Route path="servicios/nuevo" element={<ServiceFormPage />} />
            <Route path="servicios/:id" element={<ServiceFormPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="clientes/nuevo" element={<ClientFormPage />} />
            <Route path="clientes/:id" element={<ClientDetailPage />} />
            <Route path="clientes/:id/editar" element={<ClientFormPage />} />
            <Route path="trabajos" element={<JobsPage />} />
            <Route path="trabajos/nuevo" element={<JobFormPage />} />
            <Route path="trabajos/:id" element={<JobFormPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Routes>
      <SlowLoadingNotice />
      <Toaster />
    </IconAnimationContext>
  );
}
