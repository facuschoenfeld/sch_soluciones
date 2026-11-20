import type { AdminCategory } from '@sch/shared';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CategoryFormDialog } from '@/components/admin/category-form-dialog';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  mutationErrorMessage,
  useAdminCategories,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from '@/lib/admin-api';
import { getCategoryIcon } from '@/lib/category-icons';
import { LINE_LABELS } from '@/lib/service-filters';
import { focusMainOnClose } from '@/lib/focus';
import { notifyError } from '@/lib/notify';
import { AdminPageHeader } from './admin-section-page';

/** Formulario abierto: `null` = alta; una categoría = edición. */
type FormState = { category: AdminCategory | null } | undefined;

export function CategoriesPage() {
  const categories = useAdminCategories();
  const [form, setForm] = useState<FormState>();
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <AdminPageHeader
        title="Categorías"
        description="Ordená cómo aparecen en el sitio y ocultá las que no uses."
        actions={
          <Button className="min-h-11" onClick={() => setForm({ category: null })}>
            <Plus aria-hidden="true" />
            Nueva categoría
          </Button>
        }
      />

      {categories.isPending && (
        <div className="space-y-3" role="status" aria-label="Cargando categorías">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {categories.isError && !categories.data && (
        <QueryError
          error={categories.error}
          title="No se pudieron cargar las categorías"
          onRetry={() => void categories.refetch()}
        />
      )}

      {categories.data?.length === 0 && (
        <EmptyState
          icon={Tags}
          title="Todavía no hay categorías"
          description="Creá la primera para empezar a cargar servicios."
          action={
            <Button className="min-h-11" onClick={() => setForm({ category: null })}>
              <Plus aria-hidden="true" />
              Nueva categoría
            </Button>
          }
        />
      )}

      {categories.data && categories.data.length > 0 && (
        <CategoryList
          categories={categories.data}
          onEdit={(category) => setForm({ category })}
          onDelete={setToDelete}
        />
      )}

      <CategoryFormDialog
        open={form !== undefined}
        onOpenChange={(open) => !open && setForm(undefined)}
        category={form?.category ?? null}
      />
      <DeleteCategoryDialog category={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}

interface CategoryListProps {
  categories: AdminCategory[];
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
}

function CategoryList({ categories, onEdit, onDelete }: CategoryListProps) {
  const reorder = useReorderCategories();
  // Anuncio para lectores de pantalla del resultado de subir/bajar.
  const [announcement, setAnnouncement] = useState('');

  const move = (index: number, offset: -1 | 1) => {
    if (reorder.isPending) return;
    const ids = categories.map((category) => category.id);
    const target = index + offset;
    const current = ids[index];
    const other = ids[target];
    if (current === undefined || other === undefined) return;
    ids[index] = other;
    ids[target] = current;
    const name = categories[index]?.name ?? '';
    reorder.mutate(ids, {
      onSuccess: () => setAnnouncement(`${name}: posición ${target + 1} de ${categories.length}`),
      onError: (error) => notifyError(mutationErrorMessage(error, 'No se pudo cambiar el orden')),
    });
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ol className="space-y-3" aria-label="Categorías, en el orden del sitio">
        {categories.map((category, index) => {
          const Icon = getCategoryIcon(category.icon);
          return (
            <li
              key={category.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="truncate">{category.name}</span>
                    {!category.isActive && <Badge variant="secondary">Oculta</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {LINE_LABELS[category.line]} ·{' '}
                    {category.servicesCount === 1
                      ? '1 servicio'
                      : `${category.servicesCount} servicios`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-disabled={index === 0 || reorder.isPending}
                  onClick={() => index > 0 && move(index, -1)}
                  aria-label={`Subir ${category.name}`}
                  title="Subir"
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-disabled={index === categories.length - 1 || reorder.isPending}
                  onClick={() => index < categories.length - 1 && move(index, 1)}
                  aria-label={`Bajar ${category.name}`}
                  title="Bajar"
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <VisibilityButton category={category} />
                <Button
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => onEdit(category)}
                  aria-label={`Editar ${category.name}`}
                  title="Editar"
                >
                  <Pencil aria-hidden="true" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
                {/* Con servicios no se puede borrar (se oculta): el botón ni se ofrece. */}
                {category.servicesCount === 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive hover:text-destructive"
                    onClick={() => onDelete(category)}
                    aria-label={`Borrar ${category.name}`}
                    title="Borrar"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Ocultar/mostrar. Cada fila tiene su propia mutación: con una compartida, TanStack Query solo
 * correría los callbacks (aviso y error) de la última fila tocada.
 */
function VisibilityButton({ category }: { category: AdminCategory }) {
  const update = useUpdateCategory();

  // aria-disabled (no `disabled`) mientras guarda: el botón no pierde el foco y el clic se ignora.
  const toggle = () => {
    if (update.isPending) return;
    update.mutate(
      { id: category.id, patch: { isActive: !category.isActive } },
      {
        onSuccess: (saved) =>
          toast.success(
            saved.isActive
              ? `"${saved.name}" ahora se ve en el sitio`
              : `"${saved.name}" quedó oculta (con sus servicios)`,
          ),
        onError: (error) => notifyError(mutationErrorMessage(error, 'No se pudo guardar')),
      },
    );
  };

  return (
    <Button
      variant="ghost"
      className="min-h-11"
      aria-disabled={update.isPending}
      onClick={toggle}
      aria-label={`${category.isActive ? 'Ocultar' : 'Mostrar'} ${category.name}`}
      title={category.isActive ? 'Ocultar del sitio (con sus servicios)' : 'Mostrar'}
    >
      {category.isActive ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      <span className="hidden sm:inline">{category.isActive ? 'Ocultar' : 'Mostrar'}</span>
    </Button>
  );
}

function DeleteCategoryDialog({
  category,
  onClose,
}: {
  category: AdminCategory | null;
  onClose: () => void;
}) {
  const remove = useDeleteCategory();
  // El título conserva el nombre durante la animación de cierre (sin "¿Borrar ""?").
  const [shown, setShown] = useState(category);
  const [deleted, setDeleted] = useState(false);
  if (category && category !== shown) {
    setShown(category);
    setDeleted(false);
  }

  return (
    <ConfirmDialog
      open={category !== null}
      // Tras borrar, el botón que abrió el diálogo ya no existe: el foco va al contenido.
      onCloseAutoFocus={deleted ? focusMainOnClose : undefined}
      onOpenChange={(open) => {
        // Mientras se borra no se puede cerrar: "Cancelar" no frenaría un DELETE ya enviado.
        if (open || remove.isPending) return;
        remove.reset();
        onClose();
      }}
      title={`¿Borrar "${shown?.name ?? ''}"?`}
      description={<p>La categoría se borra definitivamente. No tiene servicios asociados.</p>}
      confirmLabel="Borrar"
      pendingLabel="Borrando…"
      pending={remove.isPending}
      error={
        remove.isError ? mutationErrorMessage(remove.error, 'No se pudo borrar la categoría') : null
      }
      onConfirm={() => {
        if (!category) return;
        remove.mutate(category.id, {
          onSuccess: () => {
            toast.success(`Categoría "${category.name}" borrada`);
            setDeleted(true);
            remove.reset();
            onClose();
          },
        });
      }}
    />
  );
}
