import type { LucideIcon } from 'lucide-react';
import { Clock, MapPin } from 'lucide-react';
import { QueryError } from '@/components/feedback/query-error';
import { SocialLinks } from '@/components/layout/social-links';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { WhatsappIcon } from '@/components/whatsapp/whatsapp-icon';
import { aboutParagraphs } from '@/lib/about-text';
import { usePageTitle } from '@/lib/hooks';
import { useSettings } from '@/lib/public-api';

export function ContactPage() {
  usePageTitle('Contacto');
  const settings = useSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contacto</h1>
        <p className="text-muted-foreground">
          La forma más rápida de contactarme es por WhatsApp: el mensaje ya viene armado y podés
          editarlo antes de enviarlo.
        </p>
      </header>

      <div className="mt-8">
        {settings.isPending && (
          <div className="grid gap-6 md:grid-cols-2" role="status" aria-label="Cargando">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        )}

        {settings.isError && !settings.data && (
          <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
        )}

        {settings.data && (
          <div className="grid gap-6 md:grid-cols-2">
            <section
              aria-labelledby="sobre-mi-titulo"
              className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
            >
              <h2 id="sobre-mi-titulo" className="text-xl font-semibold tracking-tight">
                Sobre mí
              </h2>
              {settings.data.tagline && <p className="font-medium">{settings.data.tagline}</p>}
              {aboutParagraphs(settings.data.aboutText).map((paragraph, index) => (
                <p key={index} className="break-words whitespace-pre-line text-foreground/90">
                  {paragraph}
                </p>
              ))}
            </section>

            <section
              aria-labelledby="datos-titulo"
              className="space-y-5 rounded-xl border bg-card p-6 shadow-sm"
            >
              <h2 id="datos-titulo" className="text-xl font-semibold tracking-tight">
                Datos de contacto
              </h2>
              {(settings.data.businessHours || settings.data.serviceArea) && (
                <dl className="space-y-4">
                  {settings.data.businessHours && (
                    <ContactItem icon={Clock} label="Horarios">
                      {settings.data.businessHours}
                    </ContactItem>
                  )}
                  {settings.data.serviceArea && (
                    <ContactItem icon={MapPin} label="Zona de atención">
                      {settings.data.serviceArea}
                    </ContactItem>
                  )}
                </dl>
              )}
              <SocialLinks settings={settings.data} />
              <WhatsappButton variant="whatsapp" size="lg" className="min-h-11 w-full">
                <WhatsappIcon aria-hidden="true" />
                Escribime por WhatsApp
              </WhatsappButton>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: string;
}) {
  return (
    // Dentro de <dl>, cada grupo solo puede contener <dt> y <dd>: el ícono va dentro del <dt>.
    <div>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="pl-7 font-medium">{children}</dd>
    </div>
  );
}
