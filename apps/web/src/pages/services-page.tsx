import { SEARCH_QUERY_MAX_LENGTH, isValidSlug, type ServiceLine } from '@sch/shared';
import { MessageCircle, PackageOpen, RotateCw, Search, SearchX } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { ServiceCard, ServiceGridSkeleton } from '@/components/services/service-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { useDebouncedValue, usePageTitle } from '@/lib/hooks';
import { useCategories, useServices } from '@/lib/public-api';
import {
  LINE_LABELS,
  filterCategoriesByLine,
  filterServicesByLine,
  lineParamFor,
  parseLineParam,
} from '@/lib/service-filters';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;

function chipClass(active: boolean) {
  return cn(
    'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-ring',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-input bg-background text-foreground hover:bg-muted',
  );
}

export function ServicesPage() {
  usePageTitle('Servicios');
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = useCategories();

  // Los parámetros de la URL se pueden editar a mano: se normalizan antes de llamar a la API
  // para no pedir nada que responda 400 (un 4xx no se reintenta y el error no se resolvería).
  const line = parseLineParam(searchParams.get('linea'));
  const rawCategory = searchParams.get('categoria') ?? '';
  const knownCategory = categories.data?.find((category) => category.slug === rawCategory);
  // Una categoría de otra línea se ignora (si no, la combinación siempre daría vacío).
  const category =
    isValidSlug(rawCategory) && !(line && knownCategory && knownCategory.line !== line)
      ? rawCategory
      : '';
  const searchText = (searchParams.get('q') ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH);
  const debouncedSearch = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);

  // Con línea y categoría en la URL, se espera a las categorías para saber si la combinación es
  // válida (si fallan, se sigue igual: en el peor caso se ve el estado vacío con "Ver todos").
  const waitForCategories = Boolean(line && category && categories.isPending);
  const services = useServices(
    { category: category || undefined, q: debouncedSearch || undefined },
    { enabled: !waitForCategories },
  );

  const updateParams = (changes: Record<string, string | null>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const selectLine = (next: ServiceLine | null) => {
    // Al cambiar de línea se limpia la categoría, que puede no pertenecer a la nueva.
    updateParams({ linea: next ? lineParamFor(next) : null, categoria: null });
  };

  const clearFilters = () => updateParams({ linea: null, categoria: null, q: null });

  const visibleCategories = filterCategoriesByLine(categories.data ?? [], line);
  const visibleServices = filterServicesByLine(services.data ?? [], line);
  const hasFilters = Boolean(line || category || searchText.trim());
  // Con keepPreviousData, mientras llega la nueva búsqueda se muestran los resultados anteriores:
  // el conteo y el estado vacío se calculan solo sobre resultados definitivos.
  const hasFinalResults = services.isSuccess && !services.isPlaceholderData;
  const countText =
    visibleServices.length === 1
      ? 'Se muestra 1 servicio'
      : `Se muestran ${visibleServices.length} servicios`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Servicios</h1>
        <p className="text-muted-foreground">
          Desarrollo de software y servicio técnico de PC. Elegí un servicio para ver el detalle o
          consultame directo por WhatsApp.
        </p>
      </header>

      <div className="mt-8 space-y-5">
        <div className="relative max-w-md">
          <Label htmlFor="buscar-servicios" className="sr-only">
            Buscar servicios
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="buscar-servicios"
            type="search"
            placeholder="Buscar servicios…"
            value={searchText}
            maxLength={SEARCH_QUERY_MAX_LENGTH}
            onChange={(event) => updateParams({ q: event.target.value })}
            className="h-11 pl-9"
          />
        </div>

        <div className="space-y-2">
          <p id="filtro-linea" className="text-sm font-medium text-muted-foreground">
            Línea
          </p>
          <div role="group" aria-labelledby="filtro-linea" className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipClass(line === null)}
              aria-pressed={line === null}
              onClick={() => selectLine(null)}
            >
              Todas
            </button>
            {(Object.keys(LINE_LABELS) as ServiceLine[]).map((option) => (
              <button
                key={option}
                type="button"
                className={chipClass(line === option)}
                aria-pressed={line === option}
                onClick={() => selectLine(option)}
              >
                {LINE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {visibleCategories.length > 0 && (
          <div className="space-y-2">
            <p id="filtro-categoria" className="text-sm font-medium text-muted-foreground">
              Categoría
            </p>
            <div role="group" aria-labelledby="filtro-categoria" className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chipClass(category === '')}
                aria-pressed={category === ''}
                onClick={() => updateParams({ categoria: null })}
              >
                Todas
              </button>
              {visibleCategories.map((option) => (
                <button
                  key={option.slug}
                  type="button"
                  className={chipClass(category === option.slug)}
                  aria-pressed={category === option.slug}
                  onClick={() => updateParams({ categoria: option.slug })}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {categories.isError && !categories.data && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            No se pudieron cargar las categorías.
            <Button
              variant="link"
              className="h-auto min-h-10 px-0"
              onClick={() => void categories.refetch()}
            >
              <RotateCw aria-hidden="true" />
              Reintentar
            </Button>
          </p>
        )}
      </div>

      <section aria-label="Resultados" aria-busy={services.isFetching} className="mt-8 space-y-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {/* Sin resultados se anuncia igual (solo para lectores: el estado vacío ya se ve abajo). */}
          {hasFinalResults &&
            (visibleServices.length > 0 ? (
              countText
            ) : (
              <span className="sr-only">No hay servicios para mostrar.</span>
            ))}
        </p>

        {services.isPending && <ServiceGridSkeleton />}
        {services.isError && !services.data && (
          <QueryError error={services.error} onRetry={() => void services.refetch()} />
        )}
        {hasFinalResults && visibleServices.length === 0 && hasFilters && (
          <EmptyState
            icon={SearchX}
            title="No encontré servicios con esos filtros"
            description="Probá con otra búsqueda o mirá todos los servicios."
            action={
              <Button variant="outline" className="min-h-11" onClick={clearFilters}>
                Ver todos los servicios
              </Button>
            }
          />
        )}
        {hasFinalResults && visibleServices.length === 0 && !hasFilters && (
          <EmptyState
            icon={PackageOpen}
            title="Todavía no hay servicios publicados"
            description="Mientras tanto, escribime y te cuento en qué te puedo ayudar."
            action={
              <WhatsappButton variant="whatsapp" className="min-h-11">
                <MessageCircle aria-hidden="true" />
                Escribime por WhatsApp
              </WhatsappButton>
            }
          />
        )}
        {services.data && visibleServices.length > 0 && (
          <ul
            className={cn(
              'grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3',
              services.isPlaceholderData && 'opacity-60',
            )}
          >
            {visibleServices.map((service) => (
              <li key={service.slug}>
                <ServiceCard service={service} headingLevel="h2" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
