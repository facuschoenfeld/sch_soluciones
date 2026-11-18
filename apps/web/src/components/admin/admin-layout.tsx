import { ExternalLink, LogOut, Menu, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLogout, useSession } from '@/lib/auth';
import { useBusinessName } from '@/lib/public-api';
import { keepFocusInMain, useFocusMainOnNavigation } from '@/lib/use-focus-main';
import { cn } from '@/lib/utils';
import { ADMIN_NAV } from './admin-nav';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-ring',
    isActive
      ? 'bg-accent font-semibold text-accent-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
}

function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink to={to} end={end} className={navLinkClass} onClick={onNavigate}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Brand() {
  const businessName = useBusinessName();
  return (
    <span className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Wrench className="size-4" aria-hidden="true" />
      </span>
      <span className="truncate">{businessName}</span>
    </span>
  );
}

/** Layout del panel: sidebar (escritorio) o menú lateral (móvil) + barra superior. */
export function AdminLayout() {
  const mainRef = useFocusMainOnNavigation();
  const session = useSession();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  // La navegación al login la hace la propia mutación (ver useLogout).
  const handleLogout = () => logout.mutate();

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-muted/40 p-4 lg:flex">
        <div className="px-2 pt-2">
          <Brand />
          <p className="mt-1 text-xs text-muted-foreground">Panel de administración</p>
        </div>
        <nav aria-label="Panel">
          <AdminNavList />
        </nav>
        <Link
          to="/"
          className="mt-auto flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground focus-ring hover:text-foreground"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Ver el sitio
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/75">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 lg:hidden"
                  aria-label="Abrir menú"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" onCloseAutoFocus={keepFocusInMain}>
                <SheetHeader>
                  <SheetTitle>
                    <Brand />
                  </SheetTitle>
                  <SheetDescription>Panel de administración</SheetDescription>
                </SheetHeader>
                <nav aria-label="Panel (móvil)" className="px-2">
                  <AdminNavList onNavigate={() => setMenuOpen(false)} />
                </nav>
                {/* En el celular el email no entra en la barra: se muestra acá. */}
                <div className="mt-auto space-y-2 border-t p-4">
                  {session.data && (
                    <p className="truncate text-sm text-muted-foreground">{session.data.email}</p>
                  )}
                  <Link
                    to="/"
                    className="flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground focus-ring hover:text-foreground"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Ver el sitio
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
            <span className="lg:hidden">
              <Brand />
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {session.data && (
              <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
                {session.data.email}
              </span>
            )}
            <ThemeToggle />
            {/* En pantallas chicas solo el ícono (con nombre accesible), para que entre la marca. */}
            <Button
              variant="ghost"
              className="min-h-11 min-w-11 px-3 sm:px-4"
              onClick={handleLogout}
              disabled={logout.isPending}
              title="Cerrar sesión"
            >
              <LogOut aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        <main ref={mainRef} id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
