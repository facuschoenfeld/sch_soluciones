import { ClipboardList, Package, Tags, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from '@/components/admin/admin-layout';
import { RequireAuth } from '@/components/admin/require-auth';
import { SlowLoadingNotice } from '@/components/feedback/slow-loading-notice';
import { UpcomingSectionPage } from '@/pages/admin/admin-section-page';
import { DashboardPage } from '@/pages/admin/dashboard-page';
import { LoginPage } from '@/pages/admin/login-page';
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
    <>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route
              path="servicios"
              element={
                <UpcomingSectionPage
                  title="Servicios"
                  icon={Package}
                  description="Desde acá vas a poder crear, editar y archivar servicios, y actualizar los precios."
                />
              }
            />
            <Route
              path="categorias"
              element={
                <UpcomingSectionPage
                  title="Categorías"
                  icon={Tags}
                  description="Desde acá vas a poder crear categorías, ordenarlas y ocultarlas."
                />
              }
            />
            <Route
              path="clientes"
              element={
                <UpcomingSectionPage
                  title="Clientes"
                  icon={Users}
                  description="Desde acá vas a ver tus clientes, sus datos de contacto y su historial de trabajos."
                />
              }
            />
            <Route
              path="trabajos"
              element={
                <UpcomingSectionPage
                  title="Trabajos"
                  icon={ClipboardList}
                  description="Desde acá vas a registrar cada trabajo, su estado y los cobros."
                />
              }
            />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Routes>
      <SlowLoadingNotice />
    </>
  );
}
