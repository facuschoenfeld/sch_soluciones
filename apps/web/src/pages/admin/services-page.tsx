import { SEARCH_QUERY_MAX_LENGTH, type AdminCategory, type AdminServiceSummary } from '@sch/shared';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Package,
  Pencil,
  Percent,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BulkPriceDialog } from '@/components/admin/bulk-price-dialog';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { InlinePriceEditor } from '@/components/admin/inline-price-editor';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  mutationErrorMessage,
  useAdminCategories,
  useAdminServices,
  useDeleteService,
  useReorderServices,
  useUpdateService,
} from '@/lib/admin-api';
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
  filterServices,
  parseFilters,
} from '@/lib/admin-service-filters';
import { focusMainIfLost, focusMainOnClose } from '@/lib/focus';
import { LONG_TOAST_MS, notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from './admin-section-page';

export function ServicesPage() {
  const services = useAdminServices();
  const categories = useAdminCategories();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminServiceSummary | null>(null);

  const filters = useMemo(() => parseFilters(params), [params]);

  const setFilter = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const visible = useMemo(
    () => (services.data ? filterServices(services.data, filters) : []),
    [services.data, filters],
  );
  // La acción masiva se aplica solo a lo seleccionado que sigue visible con los filtros.
  const selectedVisible = visible.filter((service) => selected.has(service.id));
  const allVisibleSelected = visible.length > 0 && selectedVisible.length === visible.length;

  // Reordenar tiene sentido viendo una sola categoría, en el orden del sitio y sin búsqueda.
  const canReorder = filters.categoryId !== null && filters.sort === 'sitio' && !filters.q.trim();

  const toggleSelected = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((service) => service.id)));

  return (
    <div
      className={cn(
        'mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6',
        // Lugar para la barra fija de la selección: no tapa la última fila.
        selectedVisible.length > 0 && 'pb-32',
      )}
    >
      <AdminPageHeader
        title="Servicios"
        description="Editá precios en la lista, archivá lo que ya no ofrecés y destacá lo principal."
        actions={
          <Button asChild className="min-h-11">
            <Link to="/admin/servicios/nuevo">
              <Plus aria-hidden="true" />
              Nuevo servicio
            </Link>
          </Button>
        }
      />

      <div
        role="search"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filtrar servicios"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="services-q">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="services-q"
              type="search"
              value={filters.q}
              onChange={(event) => setFilter('q', event.target.value)}
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              placeholder="Nombre o descripción"
              className="h-11 pl-9"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="services-category">Categoría</Label>
          <NativeSelect
            id="services-category"
            value={filters.categoryId ?? ''}
            onChange={(event) => setFilter('categoria', event.target.value)}
          >
            <option value="">Todas</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? '' : ' (oculta)'}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="services-status">Estado</Label>
          <NativeSelect
            id="services-status"
            value={filters.status}
            onChange={(event) => setFilter('estado', event.target.value)}
          >
            {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="services-sort">Ordenar por</Label>
          <NativeSelect
            id="services-sort"
            value={filters.sort}
            onChange={(event) => setFilter('orden', event.target.value)}
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {services.isPending && (
        <div className="space-y-3" role="status" aria-label="Cargando servicios">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {services.isError && !services.data && (
        <QueryError
          error={services.error}
          title="No se pudieron cargar los servicios"
          onRetry={() => void services.refetch()}
        />
      )}

      {services.data?.length === 0 && (
        <EmptyState
          icon={Package}
          title="Todavía no hay servicios"
          description="Creá el primero para que aparezca en el sitio."
          action={
            <Button asChild className="min-h-11">
              <Link to="/admin/servicios/nuevo">
                <Plus aria-hidden="true" />
                Nuevo servicio
              </Link>
            </Button>
          }
        />
      )}

      {services.data && services.data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="size-5 accent-primary focus-ring"
                checked={allVisibleSelected}
                disabled={visible.length === 0}
                onChange={toggleAllVisible}
              />
              Seleccionar{' '}
              {filters.categoryId || filters.q || filters.status !== 'todos'
                ? 'los filtrados'
                : 'todos'}{' '}
              ({visible.length})
            </label>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {visible.length === services.data.length
                ? `${visible.length} servicios`
                : `${visible.length} de ${services.data.length} servicios`}
            </p>
          </div>

          {/* Fija abajo (zona del pulgar) y fuera del flujo: la lista no salta al seleccionar. */}
          {selectedVisible.length > 0 && (
            <div
              className="fixed right-4 bottom-4 left-4 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur lg:left-68"
              role="region"
              aria-label="Acciones con la selección"
            >
              <p className="text-sm font-medium" aria-live="polite">
                {selectedVisible.length === 1
                  ? '1 seleccionado'
                  : `${selectedVisible.length} seleccionados`}
              </p>
              <Button className="min-h-11" onClick={() => setBulkOpen(true)}>
                <Percent aria-hidden="true" />
                Actualizar precios
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => setSelected(new Set())}>
                Quitar selección
              </Button>
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Ningún servicio coincide con los filtros"
              description="Probá con otra búsqueda o cambiá la categoría o el estado."
              action={
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                >
                  Ver todos
                </Button>
              }
            />
          ) : (
            <ServiceList
              services={visible}
              allServices={services.data}
              categories={categories.data ?? []}
              canReorder={canReorder}
              selected={selected}
              onToggleSelected={toggleSelected}
              onDelete={setToDelete}
            />
          )}
          {!canReorder && filters.sort === 'sitio' && (
            <p className="text-sm text-muted-foreground">
              Para cambiar el orden en el sitio, filtrá por una categoría (sin búsqueda).
            </p>
          )}
        </>
      )}

      <BulkPriceDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        services={selectedVisible}
        onDone={() => setSelected(new Set())}
      />
      <DeleteServiceDialog service={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}

interface ServiceListProps {
  services: AdminServiceSummary[];
  allServices: AdminServiceSummary[];
  categories: AdminCategory[];
  canReorder: boolean;
  selected: Set<number>;
  onToggleSelected: (id: number) => void;
  onDelete: (service: AdminServiceSummary) => void;
}

function ServiceList({
  services,
  allServices,
  categories,
  canReorder,
  selected,
  onToggleSelected,
  onDelete,
}: ServiceListProps) {
  const reorder = useReorderServices();
  // Anuncio para lectores de pantalla del resultado de subir/bajar.
  const [announcement, setAnnouncement] = useState('');
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  /**
   * Intercambia el servicio con su vecino visible. El orden se guarda sobre todos los servicios
   * de la categoría (también los ocultos por el filtro de estado).
   */
  const move = (service: AdminServiceSummary, offset: -1 | 1) => {
    const index = services.indexOf(service);
    const neighbor = services[index + offset];
    if (!neighbor || reorder.isPending) return;
    const ids = allServices
      .filter((item) => item.categoryId === service.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.id);
    const from = ids.indexOf(service.id);
    const to = ids.indexOf(neighbor.id);
    ids[from] = neighbor.id;
    ids[to] = service.id;
    reorder.mutate(
      { categoryId: service.categoryId, ids },
      {
        onSuccess: () =>
          setAnnouncement(`${service.name}: posición ${index + offset + 1} de ${services.length}`),
        onError: (error) => notifyError(mutationErrorMessage(error, 'No se pudo cambiar el orden')),
      },
    );
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {services.map((service, index) => (
          <li
            key={service.id}
            className={cn(
              // En una fila recién desde xl: con la barra lateral, antes no entran nombre, precio y acciones.
              'grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 p-4 xl:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,auto)_auto]',
              !service.isActive && 'bg-muted/40',
            )}
          >
            {/* El label agranda el área táctil a 44 px alrededor del checkbox. */}
            <label className="-m-3 flex size-11 cursor-pointer items-center justify-center self-start xl:self-center">
              <input
                type="checkbox"
                className="size-5 accent-primary focus-ring"
                checked={selected.has(service.id)}
                onChange={() => onToggleSelected(service.id)}
                aria-label={`Seleccionar ${service.name}`}
              />
            </label>

            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/admin/servicios/${service.id}`}
                  className="font-semibold focus-ring hover:underline"
                >
                  {service.name}
                </Link>
                {service.isFeatured && <Badge>Destacado</Badge>}
                {!service.isActive && <Badge variant="secondary">Archivado</Badge>}
                {!service.category.isActive && <Badge variant="outline">Categoría oculta</Badge>}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {categoryName.get(service.categoryId) ?? service.category.name} ·{' '}
                {service.shortDescription}
              </p>
            </div>

            <div className="col-start-2 min-w-0 xl:col-start-auto">
              <InlinePriceEditor service={service} />
              <p className="text-xs text-muted-foreground">
                Precio del {new Date(service.priceUpdatedAt).toLocaleDateString('es-AR')}
              </p>
            </div>

            <div className="col-start-2 flex flex-wrap items-center gap-1 xl:col-start-auto xl:justify-end">
              {canReorder && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-disabled={index === 0 || reorder.isPending}
                    onClick={() => index > 0 && move(service, -1)}
                    aria-label={`Subir ${service.name}`}
                    title="Subir"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-disabled={index === services.length - 1 || reorder.isPending}
                    onClick={() => index < services.length - 1 && move(service, 1)}
                    aria-label={`Bajar ${service.name}`}
                    title="Bajar"
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </>
              )}
              <ServiceStatusButtons service={service} />
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-11"
                title="Editar todos los datos"
              >
                {/* El nombre ya es un link al mismo lugar: este no suma una parada de tabulación. */}
                <Link
                  to={`/admin/servicios/${service.id}`}
                  aria-label={`Editar ${service.name}`}
                  tabIndex={-1}
                >
                  <Pencil aria-hidden="true" />
                </Link>
              </Button>
              {/* Con trabajos registrados no se borra (integridad del historial): solo se archiva. */}
              {service.jobsCount === 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-destructive hover:text-destructive"
                  onClick={() => onDelete(service)}
                  aria-label={`Borrar ${service.name}`}
                  title="Borrar"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Destacar y archivar/restaurar. Cada fila tiene su propia mutación: TanStack Query solo corre
 * los callbacks de `mutate` de la última llamada, así que con una compartida se perderían los
 * avisos (y los errores) de una fila al tocar otra.
 */
function ServiceStatusButtons({ service }: { service: AdminServiceSummary }) {
  const update = useUpdateService();
  const onError = (error: unknown) =>
    notifyError(mutationErrorMessage(error, 'No se pudo guardar'));

  // Mientras se guarda, los botones quedan con aria-disabled (no `disabled`): así no pierden el
  // foco, y el clic se ignora.
  const toggleActive = () => {
    if (update.isPending) return;
    const isActive = !service.isActive;
    update.mutate(
      { id: service.id, patch: { isActive } },
      {
        onSuccess: (saved) => {
          // Con el filtro de estado, la fila puede desaparecer junto con el botón enfocado.
          focusMainIfLost();
          toast.success(
            isActive ? `"${saved.name}" vuelve a verse en el sitio` : `"${saved.name}" archivado`,
            // Archivar no es destructivo, pero se puede deshacer al toque.
            isActive
              ? undefined
              : {
                  duration: LONG_TOAST_MS,
                  action: {
                    label: 'Deshacer',
                    onClick: () =>
                      update.mutate({ id: saved.id, patch: { isActive: true } }, { onError }),
                  },
                },
          );
        },
        onError,
      },
    );
  };

  const toggleFeatured = () => {
    if (update.isPending) return;
    update.mutate(
      { id: service.id, patch: { isFeatured: !service.isFeatured } },
      {
        onSuccess: (saved) =>
          toast.success(
            saved.isFeatured
              ? `"${saved.name}" aparece en destacados`
              : `"${saved.name}" ya no está en destacados`,
          ),
        onError,
      },
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-disabled={update.isPending}
        onClick={toggleFeatured}
        aria-label={`Destacar ${service.name}`}
        aria-pressed={service.isFeatured}
        title={service.isFeatured ? 'Quitar de destacados' : 'Destacar'}
      >
        <Star
          className={cn(service.isFeatured && 'fill-current text-primary')}
          aria-hidden="true"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-disabled={update.isPending}
        onClick={toggleActive}
        aria-label={`${service.isActive ? 'Archivar' : 'Restaurar'} ${service.name}`}
        title={service.isActive ? 'Archivar (deja de verse en el sitio)' : 'Restaurar'}
      >
        {service.isActive ? <Archive aria-hidden="true" /> : <ArchiveRestore aria-hidden="true" />}
      </Button>
    </>
  );
}

function DeleteServiceDialog({
  service,
  onClose,
}: {
  service: AdminServiceSummary | null;
  onClose: () => void;
}) {
  const remove = useDeleteService();
  // El título conserva el nombre durante la animación de cierre (sin "¿Borrar ""?").
  const [shown, setShown] = useState(service);
  const [deleted, setDeleted] = useState(false);
  if (service && service !== shown) {
    setShown(service);
    setDeleted(false);
  }

  return (
    <ConfirmDialog
      open={service !== null}
      // Tras borrar, el botón que abrió el diálogo ya no existe: el foco va al contenido.
      onCloseAutoFocus={deleted ? focusMainOnClose : undefined}
      onOpenChange={(open) => {
        // Mientras se borra no se puede cerrar: "Cancelar" no frenaría un DELETE ya enviado.
        if (open || remove.isPending) return;
        remove.reset();
        onClose();
      }}
      title={`¿Borrar "${shown?.name ?? ''}"?`}
      description={
        <>
          <p>Se borra definitivamente y su link deja de funcionar.</p>
          <p>
            Si solo querés que no se vea en el sitio, archivalo: lo podés restaurar cuando quieras.
          </p>
        </>
      }
      confirmLabel="Borrar"
      pendingLabel="Borrando…"
      pending={remove.isPending}
      error={
        remove.isError ? mutationErrorMessage(remove.error, 'No se pudo borrar el servicio') : null
      }
      onConfirm={() => {
        if (!service) return;
        remove.mutate(service.id, {
          onSuccess: () => {
            toast.success(`Servicio "${service.name}" borrado`);
            setDeleted(true);
            remove.reset();
            onClose();
          },
        });
      }}
    />
  );
}
