import { zodResolver } from '@hookform/resolvers/zod';
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  categoryInputSchema,
  slugify,
  type AdminCategory,
  type CategoryInput,
  type CategoryInputParsed,
  type ServiceLine,
} from '@sch/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { mutationErrorMessage, useSaveCategory } from '@/lib/admin-api';
import { CATEGORY_ICON_LABELS, CATEGORY_ICON_NAMES, getCategoryIcon } from '@/lib/category-icons';
import { LINE_LABELS } from '@/lib/service-filters';
import { notifyError } from '@/lib/notify';
import { FormField } from './form-field';
import { applyFieldErrors } from './form-errors';

const FIELDS = ['name', 'slug', 'description', 'icon', 'line', 'isActive'] as const;

function toFormValues(category: AdminCategory | null): CategoryInput {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    icon: category?.icon ?? '',
    line: category?.line ?? 'TECH_SUPPORT',
    isActive: category?.isActive ?? true,
  };
}

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = alta. */
  category: AdminCategory | null;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>
            Las categorías agrupan los servicios en el sitio. Una categoría oculta esconde también
            sus servicios.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se monta en cada apertura: el formulario parte de los datos actuales. */}
        <CategoryForm category={category} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category: AdminCategory | null;
  onDone: () => void;
}) {
  const save = useSaveCategory();
  const isNew = category === null;
  // En el alta, el slug sigue al nombre hasta que se edita a mano.
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const form = useForm<CategoryInput, unknown, CategoryInputParsed>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: toFormValues(category),
  });
  const { errors } = form.formState;
  const Icon = getCategoryIcon(useWatch({ control: form.control, name: 'icon' }));

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      if (!slugEdited) form.setValue('slug', slugify(event.target.value));
    },
  });

  const onSubmit = form.handleSubmit((input) => {
    save.mutate(
      { id: category?.id, input },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? `Categoría "${saved.name}" creada` : 'Cambios guardados');
          onDone();
        },
        onError: (error) => {
          if (!applyFieldErrors(form, FIELDS, error)) {
            notifyError(mutationErrorMessage(error, 'No se pudo guardar la categoría'));
          }
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <FormField id="category-name" label="Nombre" error={errors.name?.message}>
        {(aria) => (
          <Input
            {...aria}
            {...nameField}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            className="h-11"
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="category-slug"
        label="Slug (para el link)"
        hint={
          isNew
            ? 'Se arma solo a partir del nombre. Podés cambiarlo.'
            : 'Cambiarlo rompe los links que ya compartiste con esta categoría.'
        }
        error={errors.slug?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            {...form.register('slug', { onChange: () => setSlugEdited(true) })}
            maxLength={SLUG_MAX_LENGTH}
            className="h-11 font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="category-line" label="Línea" error={errors.line?.message}>
          {(aria) => (
            <NativeSelect {...aria} {...form.register('line')}>
              {(Object.keys(LINE_LABELS) as ServiceLine[]).map((line) => (
                <option key={line} value={line}>
                  {LINE_LABELS[line]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="category-icon" label="Ícono" error={errors.icon?.message}>
          {(aria) => (
            <div className="flex items-center gap-2">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <NativeSelect {...aria} {...form.register('icon')}>
                  <option value="">Genérico</option>
                  {CATEGORY_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {CATEGORY_ICON_LABELS[name] ?? name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          )}
        </FormField>
      </div>

      <FormField
        id="category-description"
        label="Descripción (opcional)"
        error={errors.description?.message}
      >
        {(aria) => (
          <Textarea
            {...aria}
            {...form.register('description')}
            maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
            rows={3}
          />
        )}
      </FormField>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 accent-primary focus-ring"
          {...form.register('isActive')}
        />
        Visible en el sitio
      </label>

      <DialogFooter>
        <Button type="button" variant="outline" className="min-h-11" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : isNew ? 'Crear categoría' : 'Guardar cambios'}
        </Button>
      </DialogFooter>
    </form>
  );
}
