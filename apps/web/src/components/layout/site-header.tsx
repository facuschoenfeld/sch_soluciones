import { MenuIcon } from '@animateicons/react/lucide/menu-icon';
import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { AnimatedIcon } from '@/components/icons/animated-icon';
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
import { keepFocusInMain } from '@/lib/use-focus-main';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from './nav-links';
import { ThemeToggle } from './theme-toggle';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-ring',
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
  );
}

const BRAND_PREFIX = 'SCH';

// Resalta la palabra "SCH" con el color de marca; si el nombre del negocio
// cambia y no empieza con esa palabra (ej. "Schmidt"), se muestra tal cual.
function BrandName({ name }: { name: string }) {
  if (name !== BRAND_PREFIX && !name.startsWith(`${BRAND_PREFIX} `)) return name;
  return (
    <>
      <span className="brand-reveal text-primary">{BRAND_PREFIX}</span>
      {name.slice(BRAND_PREFIX.length)}
    </>
  );
}

export function SiteHeader() {
  const businessName = useBusinessName();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      data-sticky-header
      className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75"
    >
      <div className="mx-auto flex h-(--sticky-header-height) max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="-mx-1 block min-w-0 truncate rounded-md px-1 py-2.5 font-heading font-semibold tracking-tight focus-ring"
        >
          <BrandName name={businessName} />
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
                <AnimatedIcon icon={MenuIcon} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" onCloseAutoFocus={keepFocusInMain}>
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
