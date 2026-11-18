import { Suspense, lazy } from 'react';
import { PanelLoading } from './require-auth';

// El panel se descarga solo al entrar a /admin.
const AdminApp = lazy(() => import('@/admin-app'));

export function AdminEntry() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <AdminApp />
    </Suspense>
  );
}
