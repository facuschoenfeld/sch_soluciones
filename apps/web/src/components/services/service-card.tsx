import { formatPrice, type PublicServiceSummary } from '@sch/shared';
import { ArrowRight, Clock, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ServiceCardProps {
  service: PublicServiceSummary;
  /** Nivel del título según la sección donde se usa (h2 en listados, h3 dentro de secciones). */
  headingLevel?: 'h2' | 'h3';
}

export function ServiceCard({ service, headingLevel: Heading = 'h3' }: ServiceCardProps) {
  const detailPath = `/servicios/${service.slug}`;

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{service.category.name}</Badge>
        {service.isFeatured && <Badge variant="outline">Destacado</Badge>}
      </div>

      <div className="space-y-2">
        <Heading className="text-lg leading-snug font-semibold">
          <Link to={detailPath} className="rounded-sm focus-ring hover:text-primary">
            {service.name}
          </Link>
        </Heading>
        <p className="text-sm text-muted-foreground">{service.shortDescription}</p>
      </div>

      <div className="mt-auto space-y-1">
        <ServicePrice service={service} />
        {service.estimatedTime && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            <span>
              <span className="sr-only">Tiempo estimado: </span>
              {service.estimatedTime}
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <WhatsappButton
          service={service}
          intent="inquiry"
          variant="whatsapp"
          className="min-h-11 flex-1"
          aria-label={`Consultar por WhatsApp sobre ${service.name}`}
        >
          <MessageCircle aria-hidden="true" />
          Consultar
        </WhatsappButton>
        <Button asChild variant="outline" className="min-h-11 flex-1">
          <Link to={detailPath} aria-label={`Ver detalle de ${service.name}`}>
            Ver detalle
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

/**
 * El monto manda (un paso más grande que el nombre, cifras tabulares para comparar entre
 * tarjetas) y la unidad ("por equipo") lo acompaña en chico. Se lee igual de corrido.
 */
function ServicePrice({ service }: { service: PublicServiceSummary }) {
  // Mismo criterio que `formatPrice`: sin monto válido es "A consultar" y no lleva unidad.
  const hasAmount =
    service.priceType !== 'QUOTE' &&
    service.priceAmount !== null &&
    Number.isFinite(service.priceAmount);
  const unit = hasAmount ? service.priceUnit?.trim() : undefined;
  return (
    // Inline, no flex: en flex el espacio entre los dos spans no se renderiza y al copiar o con
    // lector se leería "$ 30.000por equipo". Los inline se alinean por línea base solos.
    <p className="text-foreground">
      <span className="text-xl font-bold tracking-tight tabular-nums">
        {formatPrice({ ...service, priceUnit: null })}
      </span>
      {unit && (
        <>
          {' '}
          {/* Sin cortes internos: si no entra, la unidad baja entera a la línea siguiente. */}
          <span className="text-sm whitespace-nowrap text-muted-foreground">{unit}</span>
        </>
      )}
    </p>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-5" aria-hidden="true">
      <Skeleton className="h-5 w-28 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 flex-1" />
      </div>
    </div>
  );
}

/** Grilla de skeletons con un texto accesible de carga. */
export function ServiceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Cargando servicios">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <ServiceCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
