import { formatPrice } from '@sch/shared';
import {
  ArrowLeft,
  CalendarCheck,
  ChevronRight,
  Clock,
  MessagesSquare,
  SearchX,
} from 'lucide-react';
import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/hooks';
import { useService } from '@/lib/public-api';
import { lineParamFor } from '@/lib/service-filters';

// El parser de markdown es la dependencia más pesada del sitio y solo se usa acá: se carga
// aparte para que el inicio y el listado no la descarguen.
const Markdown = lazy(() =>
  import('@/components/markdown').then((module) => ({ default: module.Markdown })),
);

export function ServiceDetailPage() {
  const { slug = '' } = useParams();
  const service = useService(slug);
  // Los estados de error solo aplican sin datos: si falla un refetch en segundo plano, TanStack
  // conserva los datos anteriores y se siguen mostrando.
  const showError = service.isError && !service.data;
  const notFound = showError && service.error instanceof ApiError && service.error.status === 404;

  usePageTitle(
    service.data?.name ??
      (notFound ? 'Servicio no encontrado' : service.isPending ? null : 'Servicio'),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <nav aria-label="Ruta de navegación" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link
              to="/servicios"
              className="inline-flex min-h-10 items-center rounded-sm underline-offset-4 focus-ring hover:text-foreground hover:underline"
            >
              Servicios
            </Link>
          </li>
          {service.data && (
            <>
              <li aria-hidden="true">
                <ChevronRight className="size-4" />
              </li>
              <li aria-current="page" className="text-foreground">
                {service.data.name}
              </li>
            </>
          )}
        </ol>
      </nav>

      {service.isPending && <DetailSkeleton />}

      {notFound && (
        <EmptyState
          icon={SearchX}
          title="Servicio no encontrado"
          description="Puede que ya no esté disponible o que la dirección sea incorrecta."
          action={
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/servicios">
                <ArrowLeft aria-hidden="true" />
                Ver todos los servicios
              </Link>
            </Button>
          }
        />
      )}

      {showError && !notFound && (
        <QueryError error={service.error} onRetry={() => void service.refetch()} />
      )}

      {service.data && (
        <article className="space-y-8">
          <header className="space-y-4">
            <Badge asChild variant="secondary">
              <Link
                to={`/servicios?linea=${lineParamFor(service.data.category.line)}&categoria=${service.data.category.slug}`}
              >
                {service.data.category.name}
              </Link>
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {service.data.name}
            </h1>
            <p className="text-lg text-muted-foreground">{service.data.shortDescription}</p>
          </header>

          <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-muted-foreground">Precio</dt>
                <dd className="text-2xl font-bold">{formatPrice(service.data)}</dd>
              </div>
              {service.data.estimatedTime && (
                <div>
                  <dt className="text-sm text-muted-foreground">Tiempo estimado</dt>
                  <dd className="flex items-center gap-1.5 font-medium">
                    <Clock className="size-4" aria-hidden="true" />
                    {service.data.estimatedTime}
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col gap-2 sm:min-w-56">
              <WhatsappButton
                service={service.data}
                intent="booking"
                variant="whatsapp"
                size="lg"
                className="min-h-11"
              >
                <CalendarCheck aria-hidden="true" />
                Reservar turno
              </WhatsappButton>
              <WhatsappButton
                service={service.data}
                intent="inquiry"
                variant="outline"
                size="lg"
                className="min-h-11"
              >
                <MessagesSquare aria-hidden="true" />
                Hacer una consulta
              </WhatsappButton>
            </div>
          </div>

          {service.data.description.trim() !== '' && (
            <section aria-labelledby="descripcion-titulo" className="space-y-4">
              <h2 id="descripcion-titulo" className="text-xl font-semibold tracking-tight">
                Descripción
              </h2>
              <Suspense fallback={<DescriptionSkeleton />}>
                <Markdown>{service.data.description}</Markdown>
              </Suspense>
            </section>
          )}
        </article>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Cargando servicio">
      <div className="space-y-4">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-full" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <DescriptionLines />
    </div>
  );
}

function DescriptionLines() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function DescriptionSkeleton() {
  return (
    <div role="status" aria-label="Cargando descripción">
      <DescriptionLines />
    </div>
  );
}
