import { JOB_STATUS_LABELS, type JobStatus, type PaginationMeta } from '@sch/shared';
import { ClipboardList, Plus, SearchX, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ClientPicker } from '@/components/admin/client-picker';
import { ExportButtons } from '@/components/admin/export-buttons';
import { JobList } from '@/components/admin/job-list';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminClient, useAdminJobs, useAdminServices } from '@/lib/admin-api';
import {
  JOBS_URL_PARAMS,
  hasJobsFilters,
  isCompleteFilterDate,
  isDateRangeInverted,
  jobsApiQuery,
  jobsExportQuery,
  parseJobsFilters,
  type JobsUrlFilters,
} from '@/lib/crm-filters';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from './admin-section-page';

const STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[];

/** ", página 2 de 3" (nada si entra todo en una página). */
function pageSuffix({ page, pageSize, total }: PaginationMeta): string {
  const pages = Math.ceil(total / pageSize);
  return pages > 1 ? `, página ${page} de ${pages}` : '';
}
const FIRST_FILTER_ID = 'jobs-status';

type SetFilter = (key: keyof JobsUrlFilters, value: string | null) => void;

/**
 * Después de quitar los filtros, el botón desaparece: el foco va al primer filtro (o al
 * contenido principal si los filtros están plegados, en el celular).
 */
function focusFirstFilter() {
  requestAnimationFrame(() => {
    const first = document.getElementById(FIRST_FILTER_ID);
    if (first?.offsetParent) first.focus();
    else document.getElementById('main')?.focus({ preventScroll: true });
  });
}

/** `/admin/trabajos`: filtros en la URL (`?estado=&cliente=&servicio=&desde=&hasta=&saldo=1`). */
export function JobsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseJobsFilters(params), [params]);
  const rangeInverted = isDateRangeInverted(params);
  const jobs = useAdminJobs(jobsApiQuery(filters));
  const filtered = hasJobsFilters(filters);

  /** Cambiar un filtro vuelve a la primera página. */
  const setFilter: SetFilter = (key, value) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(JOBS_URL_PARAMS[key], value);
        else next.delete(JOBS_URL_PARAMS[key]);
        if (key !== 'page') next.delete(JOBS_URL_PARAMS.page);
        return next;
      },
      { replace: key !== 'page' },
    );

  const clearFilters = () => {
    setParams(new URLSearchParams(), { replace: true });
    focusFirstFilter();
  };

  const final = jobs.isSuccess && !jobs.isPlaceholderData;
  const total = jobs.data?.meta.total ?? 0;
  const resultText = !final
    ? jobs.isFetching
      ? 'Buscando trabajos…'
      : ''
    : total === 0
      ? filtered
        ? 'Ningún trabajo con estos filtros'
        : ''
      : `${total === 1 ? '1 trabajo' : `${total} trabajos`}${filtered ? ' con estos filtros' : ''}${pageSuffix(jobs.data.meta)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <AdminPageHeader
        title="Trabajos"
        description="Estado, cobros y datos del equipo de cada trabajo."
        actions={
          <Button asChild className="min-h-11">
            <Link to="/admin/trabajos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo trabajo
            </Link>
          </Button>
        }
      />

      <JobsFilters
        filters={filters}
        setFilter={setFilter}
        rangeInverted={rangeInverted}
        rawTo={params.get('hasta')}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" role="status">
            {resultText}
          </p>
          {filtered && (
            <Button variant="ghost" className="min-h-11" onClick={clearFilters}>
              Quitar filtros
            </Button>
          )}
        </div>
        <ExportButtons
          path="/admin/jobs/export"
          query={(format) => jobsExportQuery(filters, format)}
          fileName="trabajos"
          label="Exportar trabajos (con los filtros aplicados)"
          itemsLabel="trabajos"
        />
      </div>

      {jobs.isError ? (
        <QueryError
          error={jobs.error}
          title="No se pudieron cargar los trabajos"
          onRetry={() => void jobs.refetch()}
        />
      ) : jobs.isPending ? (
        <div className="space-y-2" role="status" aria-label="Cargando trabajos">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : jobs.data.data.length === 0 ? (
        // Página vacía primero (ej. otra pestaña cambió trabajos): "Ver todos" borraría los filtros.
        total > 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Esta página está vacía"
            action={
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setFilter('page', null)}
              >
                Ir a la primera página
              </Button>
            }
          />
        ) : filtered ? (
          <EmptyState
            icon={SearchX}
            title="Ningún trabajo coincide con los filtros"
            description="Probá con otro estado, cliente o rango de fechas."
            action={
              <Button variant="outline" className="min-h-11" onClick={clearFilters}>
                Ver todos
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Todavía no registraste trabajos"
            description="Cargá cada trabajo para seguir su estado y sus cobros."
            action={
              <Button asChild className="min-h-11">
                <Link to="/admin/trabajos/nuevo">
                  <Plus aria-hidden="true" />
                  Nuevo trabajo
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <div
            aria-busy={jobs.isPlaceholderData}
            className={cn('transition-opacity', jobs.isPlaceholderData && 'opacity-60')}
          >
            <JobList jobs={jobs.data.data} />
          </div>
          <Pagination
            meta={jobs.data.meta}
            onPageChange={(page) => setFilter('page', page > 1 ? String(page) : null)}
            itemsLabel="trabajos"
            pending={jobs.isPlaceholderData}
          />
        </>
      )}
    </div>
  );
}

function countActive(filters: JobsUrlFilters): number {
  return [
    filters.status,
    filters.clientId,
    filters.serviceId,
    filters.from || filters.to,
    filters.balanceDue,
  ].filter(Boolean).length;
}

function JobsFilters({
  filters,
  setFilter,
  rangeInverted,
  rawTo,
}: {
  filters: JobsUrlFilters;
  setFilter: SetFilter;
  rangeInverted: boolean;
  /** "hasta" tal cual está en la URL (para mostrarlo aunque esté invertido). */
  rawTo: string | null;
}) {
  const services = useAdminServices();
  const client = useAdminClient(filters.clientId ?? undefined);
  // En el celular los filtros se pliegan (si no, ocupan la pantalla antes del primer trabajo).
  const [open, setOpen] = useState(false);
  const active = countActive(filters);

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="min-h-11 sm:hidden"
        aria-expanded={open}
        aria-controls="jobs-filters"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filtros{active > 0 && ` (${active})`}
      </Button>

      <div
        id="jobs-filters"
        role="search"
        aria-label="Filtrar trabajos"
        className={cn(
          'gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid sm:grid-cols-2 lg:grid-cols-3',
          open ? 'grid' : 'hidden',
        )}
      >
        <div className="grid gap-1.5">
          <Label htmlFor={FIRST_FILTER_ID}>Estado</Label>
          <NativeSelect
            id={FIRST_FILTER_ID}
            value={filters.status ?? ''}
            onChange={(event) => setFilter('status', event.target.value || null)}
          >
            <option value="">Todos</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="jobs-service">Servicio</Label>
          <NativeSelect
            id="jobs-service"
            value={filters.serviceId ?? ''}
            onChange={(event) => setFilter('serviceId', event.target.value || null)}
            aria-describedby={services.isError ? 'jobs-service-error' : undefined}
          >
            <option value="">Todos</option>
            {/* Un servicio del link que no está en la lista se ofrece igual para poder quitarlo. */}
            {filters.serviceId && !services.data?.some((s) => s.id === filters.serviceId) && (
              <option value={filters.serviceId}>
                {services.isPending ? 'Cargando…' : `Servicio #${filters.serviceId}`}
              </option>
            )}
            {services.data?.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
                {service.isActive ? '' : ' (archivado)'}
              </option>
            ))}
          </NativeSelect>
          {services.isError && (
            <p id="jobs-service-error" className="text-sm font-medium text-destructive-text">
              No se pudieron cargar los servicios.{' '}
              <button
                type="button"
                className="min-h-11 underline focus-ring"
                onClick={() => void services.refetch()}
              >
                Reintentar
              </button>
            </p>
          )}
        </div>

        <div className="grid content-start gap-1.5 sm:col-span-2 lg:col-span-1 lg:row-span-2">
          <Label id="jobs-client-label" htmlFor="jobs-client">
            Cliente
          </Label>
          {/* Siempre montado (sin esqueleto): así el foco no se pierde al elegir un cliente. */}
          <ClientPicker
            id="jobs-client"
            clearLabel="Quitar"
            value={
              filters.clientId
                ? {
                    id: filters.clientId,
                    fullName:
                      client.data?.fullName ??
                      (client.isError ? `Cliente #${filters.clientId}` : 'Cargando…'),
                    phone: client.data?.phone,
                  }
                : null
            }
            onChange={(next) => setFilter('clientId', next ? String(next.id) : null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
          <DateFilter
            id="jobs-from"
            label="Ingreso desde"
            value={filters.from}
            max={filters.to || undefined}
            onCommit={(value) => setFilter('from', value)}
          />
          <DateFilter
            id="jobs-to"
            label="Ingreso hasta"
            // Invertido: se muestra lo escrito (con el aviso) en vez de vaciar el campo a mitad.
            value={rangeInverted ? (rawTo ?? '') : filters.to}
            min={filters.from || undefined}
            error={rangeInverted ? 'Es anterior a "desde": no se tiene en cuenta.' : undefined}
            onCommit={(value) => setFilter('to', value)}
          />
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2 lg:col-span-3">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-primary focus-ring"
            checked={filters.balanceDue}
            onChange={(event) => setFilter('balanceDue', event.target.checked ? '1' : null)}
          />
          Solo terminados con saldo a cobrar
        </label>
      </div>
    </div>
  );
}

interface DateFilterProps {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  error?: string;
  onCommit: (value: string | null) => void;
}

/**
 * Fecha del filtro. El texto se guarda en un borrador: al tipear el año, el navegador emite
 * valores parciales ("0002-11-23") que no se mandan a la URL (si no, el campo se vaciaría y
 * cada dígito sería una búsqueda). Se aplica cuando la fecha está completa o se borra.
 */
function DateFilter({ id, label, value, min, max, error, onCommit }: DateFilterProps) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // Si la URL cambia desde afuera (quitar filtros, atrás/adelante), se muestra.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={draft}
        min={min}
        max={max}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next === '') onCommit(null);
          else if (isCompleteFilterDate(next)) onCommit(next);
        }}
        // Una fecha a medio escribir que se abandona vuelve a la aplicada.
        onBlur={() => {
          if (draft !== '' && !isCompleteFilterDate(draft)) setDraft(value);
        }}
        className="h-11"
      />
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive-text">
          {error}
        </p>
      )}
    </div>
  );
}
