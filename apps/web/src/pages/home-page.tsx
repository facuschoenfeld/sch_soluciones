import type { PublicCategory, ServiceLine } from '@sch/shared';
import {
  ArrowRight,
  Code,
  Handshake,
  MessageCircle,
  MousePointerClick,
  PackageOpen,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { ServiceCard, ServiceGridSkeleton } from '@/components/services/service-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { getCategoryIcon } from '@/lib/category-icons';
import { usePageTitle } from '@/lib/hooks';
import { useCategories, useServices, useSettings } from '@/lib/public-api';
import { LINE_LABELS, filterCategoriesByLine, lineParamFor } from '@/lib/service-filters';

// Textos de respaldo si la configuración no carga: el inicio sigue siendo útil.
const FALLBACK_HERO_TITLE = 'Soluciones en desarrollo y servicio técnico';
const FALLBACK_HERO_SUBTITLE =
  'Páginas web, aplicaciones de escritorio y mantenimiento de PC para tu casa o negocio.';

const LINES: { line: ServiceLine; icon: LucideIcon; description: string }[] = [
  {
    line: 'DEVELOPMENT',
    icon: Code,
    description: 'Páginas web y aplicaciones de escritorio a medida para tu negocio.',
  },
  {
    line: 'TECH_SUPPORT',
    icon: Wrench,
    description: 'Mantenimiento, reparación, diagnóstico e instalación de Windows.',
  },
];

const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: MousePointerClick,
    title: 'Elegí el servicio',
    description: 'Mirá los servicios, precios y tiempos estimados.',
  },
  {
    icon: MessageCircle,
    title: 'Escribime por WhatsApp',
    description: 'El mensaje ya viene armado; podés editarlo antes de enviarlo.',
  },
  {
    icon: Handshake,
    title: 'Coordinamos',
    description: 'Acordamos turno o presupuesto y me ocupo del resto.',
  },
];

export function HomePage() {
  usePageTitle(null);

  return (
    <>
      <Hero />
      <ServiceLines />
      <FeaturedServices />
      <HowItWorks />
      <FinalCta />
    </>
  );
}

function Hero() {
  const settings = useSettings();

  return (
    <section className="border-b bg-linear-to-b from-accent/60 to-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        {settings.isPending ? (
          <div className="max-w-3xl space-y-4" role="status" aria-label="Cargando">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-6 w-full max-w-xl" />
          </div>
        ) : (
          <div className="max-w-3xl space-y-5">
            {/* Display fluido: ~38 px en el celular, ~60 px en escritorio. La parte en `vw` no
                crece con el zoom, así que se mantiene chica frente a la parte en rem (WCAG 1.4.4).
                El título se edita desde el panel: una palabra larga se corta en vez de generar
                scroll horizontal a 320 px (WCAG 1.4.10). */}
            <h1 className="text-[clamp(2.25rem,1.75rem+2.5vw,4rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance wrap-break-word hyphens-auto">
              {settings.data?.heroTitle || FALLBACK_HERO_TITLE}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
              {/* `||`: un texto vacío guardado desde el panel también cae al siguiente. */}
              {settings.data?.heroSubtitle || settings.data?.tagline || FALLBACK_HERO_SUBTITLE}
            </p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-11">
            <Link to="/servicios">
              Ver servicios
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <WhatsappButton variant="whatsapp" size="lg" className="min-h-11">
            <MessageCircle aria-hidden="true" />
            Escribime por WhatsApp
          </WhatsappButton>
        </div>
      </div>
    </section>
  );
}

function ServiceLines() {
  const categories = useCategories();

  return (
    <section aria-labelledby="lineas-titulo" className="mx-auto max-w-6xl px-4 py-16">
      <h2 id="lineas-titulo" className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
        ¿Qué necesitás?
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {LINES.map(({ line, icon: Icon, description }) => (
          // Tarjeta clickeable: el link está solo en el título (nombre accesible corto) y su
          // pseudo-elemento cubre toda la tarjeta.
          <article
            key={line}
            className="group relative flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                <Link
                  to={`/servicios?linea=${lineParamFor(line)}`}
                  className="outline-none after:absolute after:inset-0 after:rounded-xl"
                >
                  {LINE_LABELS[line]}
                </Link>
              </h3>
              <p className="text-muted-foreground">{description}</p>
            </div>
            {categories.data && (
              <CategoryList categories={filterCategoriesByLine(categories.data, line)} />
            )}
            <span
              className="mt-auto inline-flex items-center gap-1 font-medium text-primary"
              aria-hidden="true"
            >
              Ver servicios
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function CategoryList({ categories }: { categories: PublicCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Categorías">
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.icon);
        return (
          <li
            key={category.slug}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm"
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {category.name}
          </li>
        );
      })}
    </ul>
  );
}

function FeaturedServices() {
  const services = useServices();
  const featured = services.data?.filter((service) => service.isFeatured) ?? [];

  return (
    <section aria-labelledby="destacados-titulo" className="border-y bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="destacados-titulo"
            className="text-2xl font-bold tracking-tight text-balance sm:text-3xl"
          >
            Servicios destacados
          </h2>
          <Button asChild variant="link" className="min-h-11 px-0">
            <Link to="/servicios">
              Ver todos los servicios
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="mt-8">
          {services.isPending && <ServiceGridSkeleton count={3} />}
          {services.isError && !services.data && (
            <QueryError error={services.error} onRetry={() => void services.refetch()} />
          )}
          {services.isSuccess && featured.length === 0 && (
            <EmptyState
              icon={PackageOpen}
              title="Todavía no hay servicios destacados"
              description="Mirá el listado completo para ver todo lo que ofrezco."
            />
          )}
          {featured.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((service) => (
                <li key={service.slug}>
                  <ServiceCard service={service} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-titulo" className="mx-auto max-w-6xl px-4 py-16">
      <h2
        id="como-funciona-titulo"
        className="text-2xl font-bold tracking-tight text-balance sm:text-3xl"
      >
        Cómo funciona
      </h2>
      <ol className="mt-8 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="font-semibold">
                <span className="sr-only">Paso {index + 1}: </span>
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-balance">
            ¿No encontrás lo que buscás?
          </h2>
          <p className="text-primary-foreground/90">
            Contame qué necesitás y te respondo a la brevedad.
          </p>
        </div>
        <WhatsappButton variant="secondary" size="lg" className="min-h-11 shrink-0">
          <MessageCircle aria-hidden="true" />
          Escribime por WhatsApp
        </WhatsappButton>
      </div>
    </section>
  );
}
