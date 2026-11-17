import { Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { useBusinessName, useSettings } from '@/lib/public-api';
import { NAV_LINKS } from './nav-links';
import { SocialLinks } from './social-links';

export function SiteFooter() {
  const { data: settings } = useSettings();
  const businessName = useBusinessName();

  return (
    // pb extra en móvil para que el botón flotante de WhatsApp no tape el contenido.
    <footer className="border-t bg-muted/40 pb-20 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="font-semibold">{businessName}</p>
          {settings?.tagline && <p className="text-sm text-muted-foreground">{settings.tagline}</p>}
        </div>

        <nav aria-label="Pie de página">
          <p className="mb-2 text-sm font-semibold">Secciones</p>
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex min-h-10 items-center rounded-sm text-sm text-muted-foreground underline-offset-4 focus-ring hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {settings && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">Atención</p>
            {settings.businessHours && (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {settings.businessHours}
              </p>
            )}
            {settings.serviceArea && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {settings.serviceArea}
              </p>
            )}
            <SocialLinks settings={settings} />
          </div>
        )}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {businessName}
        </p>
      </div>
    </footer>
  );
}
