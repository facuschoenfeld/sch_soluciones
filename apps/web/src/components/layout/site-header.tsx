import { Menu, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useBusinessName } from '@/lib/public-api';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from './nav-links';
import { ThemeToggle } from './theme-toggle';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-ring',
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
  );
}

export function SiteHeader() {
  const businessName = useBusinessName();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-md font-semibold tracking-tight focus-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate">{businessName}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <nav aria-label="Principal" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} end={link.end} className={navLinkClass}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <ThemeToggle />

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Abrir menú"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              // Al navegar desde el menú, el layout ya movió el foco al <main>: se evita que
              // Radix lo devuelva al botón "Abrir menú" al cerrar.
              onCloseAutoFocus={(event) => {
                if (document.getElementById('main')?.contains(document.activeElement)) {
                  event.preventDefault();
                }
              }}
            >
              <SheetHeader>
                <SheetTitle>{businessName}</SheetTitle>
                <SheetDescription className="sr-only">Menú de navegación</SheetDescription>
              </SheetHeader>
              <nav aria-label="Principal (móvil)" className="px-2">
                <ul className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.end}
                        onClick={() => setMenuOpen(false)}
                        className={(state) => cn(navLinkClass(state), 'block py-3 text-base')}
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
