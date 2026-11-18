import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { QueryError } from '@/components/feedback/query-error';
import { useSession } from '@/lib/auth';

/**
 * Rutas del panel: sin sesión redirige al login (con `?next=` para volver). Es solo UX: la
 * protección real es `requireAuth` en la API, que responde 401 a todo /api/admin sin sesión.
 */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.data) return <Outlet />;

  if (session.data === null) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (session.isError) {
    return (
      <main
        id="main"
        className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4"
      >
        <QueryError
          error={session.error}
          title="No se pudo verificar tu sesión"
          onRetry={() => void session.refetch()}
        />
        <Button asChild variant="link" className="min-h-11 self-center">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            Volver al sitio
          </Link>
        </Button>
      </main>
    );
  }

  return <PanelLoading />;
}

export function PanelLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <LoaderCircle
        className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="sr-only">Cargando el panel…</span>
    </div>
  );
}
