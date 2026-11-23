import { CLIENT_SOURCE_LABELS, SEARCH_QUERY_MAX_LENGTH } from '@sch/shared';
import { Plus, Search, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ExportButtons } from '@/components/admin/export-buttons';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminClients } from '@/lib/admin-api';
import { clientsApiQuery, clientsExportQuery, parseClientsFilters } from '@/lib/crm-filters';
import { useDebouncedValue } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from './admin-section-page';

/** `/admin/clientes`: búsqueda y paginación en la URL (`?q=&pagina=`). */
export function ClientsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseClientsFilters(params), [params]);
  // El texto vive en la URL (se ve al instante); la búsqueda a la API sale al dejar de escribir.
  const q = useDebouncedValue(filters.q.trim(), 300);
  const clients = useAdminClients(clientsApiQuery({ q, page: filters.page }));

  const setText = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('q', value);
        else next.delete('q');
        next.delete('pagina');
        return next;
      },
      { replace: true },
    );
  const setPage = (page: number) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (page > 1) next.set('pagina', String(page));
      else next.delete('pagina');
      return next;
    });

  const searching = filters.q.trim() !== '';
  const clearSearch = () => {
    setText('');
    // El botón desaparece con el estado vacío: el foco vuelve al buscador.
    requestAnimationFrame(() => document.getElementById('clients-q')?.focus());
  };
  const final = clients.isSuccess && !clients.isPlaceholderData;
  const meta = clients.data?.meta;
  const pages = meta ? Math.ceil(meta.total / meta.pageSize) : 0;
  const resultText =
    !final || !meta
      ? clients.isFetching
        ? 'Buscando clientes…'
        : ''
      : meta.total === 0
        ? searching
          ? 'Ningún cliente coincide con la búsqueda'
          : ''
        : `${meta.total === 1 ? '1 cliente' : `${meta.total} clientes`}${
            pages > 1 ? `, página ${meta.page} de ${pages}` : ''
          }`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <AdminPageHeader
        title="Clientes"
        description="Datos de contacto e historial de trabajos de cada cliente."
        actions={
          <Button asChild className="min-h-11">
            <Link to="/admin/clientes/nuevo">
              <Plus aria-hidden="true" />
              Nuevo cliente
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="search" aria-label="Buscar clientes" className="grid w-full gap-1.5 sm:max-w-sm">
          <Label htmlFor="clients-q">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="clients-q"
              type="search"
              value={filters.q}
              onChange={(event) => setText(event.target.value)}
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              placeholder="Nombre, teléfono o email"
              autoComplete="off"
              className="h-11 pl-9"
            />
          </div>
        </div>
        <ExportButtons
          path="/admin/clients/export"
          query={(format) => clientsExportQuery(filters, format)}
          fileName="clientes"
          label="Exportar clientes (con la búsqueda aplicada)"
          itemsLabel="clientes"
        />
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        {resultText}
      </p>

      {clients.isError ? (
        <QueryError
          error={clients.error}
          title="No se pudieron cargar los clientes"
          onRetry={() => void clients.refetch()}
        />
      ) : clients.isPending ? (
        <div className="space-y-2" role="status" aria-label="Cargando clientes">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : clients.data.data.length === 0 ? (
        clients.data.meta.total > 0 ? (
          <EmptyState
            icon={Users}
            title="Esta página está vacía"
            action={
              <Button variant="outline" className="min-h-11" onClick={() => setPage(1)}>
                Ir a la primera página
              </Button>
            }
          />
        ) : searching ? (
          <EmptyState
            icon={Search}
            title="Ningún cliente coincide con la búsqueda"
            description="Probá con parte del nombre, el teléfono (solo números) o el email."
            action={
              <Button variant="outline" className="min-h-11" onClick={clearSearch}>
                Ver todos
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Todavía no cargaste clientes"
            description="Agregá a quienes te contactan para llevar su historial de trabajos."
            action={
              <Button asChild className="min-h-11">
                <Link to="/admin/clientes/nuevo">
                  <Plus aria-hidden="true" />
                  Nuevo cliente
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <ul
            className={cn(
              'divide-y rounded-xl border bg-card shadow-sm transition-opacity',
              clients.isPlaceholderData && 'opacity-60',
            )}
            aria-busy={clients.isPlaceholderData}
          >
            {clients.data.data.map((client) => (
              <li
                key={client.id}
                className="grid gap-x-4 gap-y-1 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    to={`/admin/clientes/${client.id}`}
                    className="font-semibold break-words focus-ring hover:underline"
                  >
                    {client.fullName}
                  </Link>
                  <p className="text-sm break-words text-muted-foreground">
                    <span className="tabular-nums">{client.phone}</span>
                    {client.email && ` · ${client.email}`}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground sm:text-right">
                  {client.jobsCount === 1 ? '1 trabajo' : `${client.jobsCount} trabajos`} ·{' '}
                  {CLIENT_SOURCE_LABELS[client.source]}
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            meta={clients.data.meta}
            onPageChange={setPage}
            itemsLabel="clientes"
            pending={clients.isPlaceholderData}
          />
        </>
      )}
    </div>
  );
}
