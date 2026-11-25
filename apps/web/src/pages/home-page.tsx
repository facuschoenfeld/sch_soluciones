import { ArrowRightIcon } from '@animateicons/react/lucide/arrow-right-icon';
import { CodeIcon } from '@animateicons/react/lucide/code-icon';
import { WrenchIcon } from '@animateicons/react/lucide/wrench-icon';
import type { PublicCategory, ServiceLine } from '@sch/shared';
import { Handshake, MousePointerClick, PackageOpen } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { AnimatedIcon, type AnimateIcon } from '@/components/icons/animated-icon';
import { ServiceCard, ServiceGridSkeleton } from '@/components/services/service-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { WhatsappIcon } from '@/components/whatsapp/whatsapp-icon';
import { getCategoryIcon } from '@/lib/category-icons';
import { usePageTitle } from '@/lib/hooks';
import { useCategories, useServices, useSettings } from '@/lib/public-api';
import { LINE_LABELS, filterCategoriesByLine, lineParamFor } from '@/lib/service-filters';
import { cn } from '@/lib/utils';

// Textos de respaldo si la configuración no carga: el inicio sigue siendo útil.
const FALLBACK_HERO_TITLE = 'Soluciones en desarrollo y servicio técnico';
const FALLBACK_HERO_SUBTITLE =
  'Páginas web, aplicaciones de escritorio y mantenimiento de PC para tu casa o negocio.';

/** Tamaño del título del hero; lo comparte el skeleton para ocupar el mismo alto. */
const HERO_TITLE_SIZE = 'text-[clamp(2.25rem,1.75rem+2.5vw,4rem)]';

const LINES: { line: ServiceLine; icon: AnimateIcon; description: string }[] = [
  {
    line: 'DEVELOPMENT',
    icon: CodeIcon,
    description: 'Páginas web y aplicaciones de escritorio a medida para tu negocio.',
  },
  {
    line: 'TECH_SUPPORT',
    icon: WrenchIcon,
    description: 'Mantenimiento, reparación, diagnóstico e instalación de Windows.',
  },
];

const STEPS: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}[] = [
  {
    icon: MousePointerClick,
    title: 'Elegí el servicio',
    description: 'Mirá los servicios, precios y tiempos estimados.',
  },
  {
    icon: WhatsappIcon,
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
  const heroTitle = settings.data?.heroTitle?.trim() || FALLBACK_HERO_TITLE;

  return (
    <section className="border-b bg-linear-to-b from-accent/60 to-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        {settings.isPending ? (
          // Mismas medidas que el contenido (en `em` de cada tamaño, con su interlineado): 3 líneas
          // de título y de subtítulo en el celular, 2 desde 640 px, como el texto de respaldo. Un
          // título propio más largo o más corto puede mover los botones una línea.
          <div className="max-w-3xl space-y-5" role="status" aria-label="Cargando">
            <div className={cn(HERO_TITLE_SIZE, 'space-y-[0.05em] py-[0.025em]')}>
              <Skeleton className="h-[1em] w-full" />
              <Skeleton className="h-[1em] w-2/3" />
              <Skeleton className="h-[1em] w-1/2 sm:hidden" />
            </div>
            <div className="max-w-2xl space-y-[0.625em] py-[0.3125em] text-lg sm:text-xl">
              <Skeleton className="h-[1em] w-full" />
              <Skeleton className="h-[1em] w-5/6" />
              <Skeleton className="h-[1em] w-1/2 sm:hidden" />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl space-y-5">
            {/* Display fluido: ~38 px en el celular, ~60 px en escritorio. La parte en `vw` no
                crece con el zoom, así que se mantiene chica frente a la parte en rem (WCAG 1.4.4).
                El título se edita desde el panel: una palabra larga se corta en vez de generar
                scroll horizontal a 320 px (WCAG 1.4.10). */}
            <h1
              className={cn(
                HERO_TITLE_SIZE,
                'leading-[1.05] font-bold tracking-[-0.02em] text-balance wrap-break-word hyphens-auto',
              )}
              // El nombre va entero en el h1: algunos lectores (VoiceOver en iOS) leen cada
              // `span` inline-block por separado al navegar con gestos.
              aria-label={heroTitle}
            >
              {/* Entrada palabra por palabra (`.hero-word` en index.css): una ola corta, con demora
                  tope de 8 pasos; con "reducir movimiento" queda en un fundido. */}
              {heroTitle.split(/\s+/).flatMap((word, i) => [
                i > 0 ? ' ' : '',
                <span
                  key={i}
                  aria-hidden="true"
                  className="hero-word"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                >
                  {word}
                </span>,
              ])}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
              {/* `||`: un texto vacío guardado desde el panel también cae al siguiente. */}
              {settings.data?.heroSubtitle || settings.data?.tagline || FALLBACK_HERO_SUBTITLE}
            </p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {/* Respuesta: la flecha se anima al apuntar o enfocar y el botón cede apenas al presionar. */}
          <Button asChild size="lg" className="min-h-11 motion-safe:active:scale-[0.98]">
            <Link to="/servicios">
              Ver servicios
              <AnimatedIcon icon={ArrowRightIcon} />
            </Link>
          </Button>
          <WhatsappButton variant="whatsapp" size="lg" className="min-h-11">
            <WhatsappIcon aria-hidden="true" />
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
      <h2
        id="lineas-titulo"
        className="reveal text-2xl font-bold tracking-tight text-balance sm:text-3xl"
      >
        ¿Qué necesitás?
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {LINES.map(({ line, icon: Icon, description }) => (
          // Tarjeta clickeable: el link está solo en el título (nombre accesible corto) y su
          // pseudo-elemento cubre toda la tarjeta.
          <article
            key={line}
            data-icon-trigger
            className="reveal group relative flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <AnimatedIcon icon={Icon} size={24} />
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
              <AnimatedIcon icon={ArrowRightIcon} />
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
            className="reveal text-2xl font-bold tracking-tight text-balance sm:text-3xl"
          >
            Servicios destacados
          </h2>
          {/* `has-[>svg,>[data-animated-icon]]:px-0`: el tamaño por defecto del botón agrega relleno cuando hay ícono, y
              el link quedaba corrido del borde de la grilla. */}
          <Button
            asChild
            variant="link"
            className="min-h-11 px-0 has-[>svg,>[data-animated-icon]]:px-0"
          >
            <Link to="/servicios">
              Ver todos los servicios
              <AnimatedIcon icon={ArrowRightIcon} />
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
                <li key={service.slug} className="reveal">
                  {/* En "Servicios destacados" el badge "Destacado" se repetiría en cada tarjeta. */}
                  <ServiceCard service={service} showFeaturedBadge={false} />
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
        className="reveal text-2xl font-bold tracking-tight text-balance sm:text-3xl"
      >
        Cómo funciona
      </h2>
      {/* Tres columnas recién desde 1024 px: en tablet quedaban de ~200 px y los títulos y
          descripciones se partían en muchas líneas. */}
      <ol className="mt-8 grid gap-6 lg:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <li key={title} className="reveal flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="font-heading font-semibold">
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
      <div className="reveal flex flex-col items-start gap-4 rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-balance">
            ¿No encontrás lo que buscás?
          </h2>
          <p className="text-primary-foreground/90">
            Contame qué necesitás y te respondo a la brevedad.
          </p>
        </div>
        <WhatsappButton variant="secondary" size="lg" className="min-h-11 shrink-0">
          <WhatsappIcon aria-hidden="true" />
          Escribime por WhatsApp
        </WhatsappButton>
      </div>
    </section>
  );
}
