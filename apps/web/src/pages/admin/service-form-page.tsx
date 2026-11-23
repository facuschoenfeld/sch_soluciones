import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  ESTIMATED_TIME_MAX_LENGTH,
  PRICE_UNIT_MAX_LENGTH,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_SHORT_DESCRIPTION_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  formatPrice,
  serviceInputSchema,
  slugify,
  type AdminCategory,
  type AdminServiceDetail,
  type PriceType,
  type ServiceInput,
  type ServiceInputParsed,
} from '@sch/shared';
import { ArrowLeft, ExternalLink, Package, Tags } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AmountField } from '@/components/admin/amount-field';
import { applyFieldErrors } from '@/components/admin/form-errors';
import { FormField } from '@/components/admin/form-field';
import { MarkdownEditor } from '@/components/admin/markdown-editor';
import { TemplateField } from '@/components/admin/template-field';
import { useUnsavedChangesGuard } from '@/components/admin/unsaved-changes-guard';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  mutationErrorMessage,
  useAdminCategories,
  useAdminService,
  useSaveService,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { useSettings } from '@/lib/public-api';
import { notifyError } from '@/lib/notify';
import { AdminPageHeader } from './admin-section-page';

const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  FIXED: 'Precio fijo',
  FROM: 'Desde (precio mínimo)',
  QUOTE: 'A consultar',
};

const FIELDS = [
  'categoryId',
  'name',
  'slug',
  'shortDescription',
  'description',
  'priceType',
  'priceAmount',
  'currency',
  'priceUnit',
  'estimatedTime',
  'whatsappTemplate',
  'isActive',
  'isFeatured',
] as const;

const BACK_TO_LIST = '/admin/servicios';

function toFormValues(service: AdminServiceDetail | undefined, categoryId: number): ServiceInput {
  return {
    categoryId: service?.categoryId ?? categoryId,
    name: service?.name ?? '',
    slug: service?.slug ?? '',
    shortDescription: service?.shortDescription ?? '',
    description: service?.description ?? '',
    priceType: service?.priceType ?? 'FIXED',
    priceAmount: service?.priceAmount ?? null,
    currency: service?.currency ?? 'ARS',
    priceUnit: service?.priceUnit ?? '',
    estimatedTime: service?.estimatedTime ?? '',
    whatsappTemplate: service?.whatsappTemplate ?? '',
    isActive: service?.isActive ?? true,
    isFeatured: service?.isFeatured ?? false,
  };
}

/** `/admin/servicios/nuevo` y `/admin/servicios/:id`. */
export function ServiceFormPage() {
  const params = useParams();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : undefined;
  const isNew = params.id === undefined;
  const categories = useAdminCategories();
  const service = useAdminService(id);
  const title = isNew ? 'Nuevo servicio' : 'Editar servicio';

  let content: ReactNode;
  if (
    (!isNew && id === undefined) ||
    (service.error instanceof ApiError && service.error.status === 404)
  ) {
    content = (
      <EmptyState
        icon={Package}
        title="El servicio no existe"
        description="Puede que lo hayas borrado. Volvé al listado para ver los que hay."
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link to={BACK_TO_LIST}>Ver servicios</Link>
          </Button>
        }
      />
    );
  } else if (categories.isError || service.isError) {
    content = (
      <QueryError
        error={categories.error ?? service.error}
        title="No se pudo cargar el formulario"
        onRetry={() => {
          void categories.refetch();
          if (id !== undefined) void service.refetch();
        }}
      />
    );
  } else if (categories.isPending || (!isNew && service.isPending)) {
    content = (
      <div className="space-y-4" role="status" aria-label="Cargando">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  } else if (categories.data.length === 0) {
    content = (
      <EmptyState
        icon={Tags}
        title="Primero creá una categoría"
        description="Cada servicio pertenece a una categoría."
        action={
          <Button asChild className="min-h-11">
            <Link to="/admin/categorias">Ir a categorías</Link>
          </Button>
        }
      />
    );
  } else {
    content = (
      <ServiceForm
        key={service.data?.id ?? 'new'}
        service={isNew ? undefined : service.data}
        categories={categories.data}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="link" className="-ml-3 min-h-11 px-3">
        <Link to={BACK_TO_LIST}>
          <ArrowLeft aria-hidden="true" />
          Volver a servicios
        </Link>
      </Button>
      <AdminPageHeader
        title={title}
        description={isNew ? undefined : service.data?.name}
        actions={
          service.data?.isActive && service.data.category.isActive ? (
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/servicios/${service.data.slug}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" />
                Ver en el sitio
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </Button>
          ) : undefined
        }
      />
      {content}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `section-${slugify(title)}`;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ServiceForm({
  service,
  categories,
}: {
  service: AdminServiceDetail | undefined;
  categories: AdminCategory[];
}) {
  const navigate = useNavigate();
  const save = useSaveService();
  const settings = useSettings();
  const isNew = service === undefined;
  // En el alta, el slug sigue al nombre hasta que se edita a mano.
  const [slugEdited, setSlugEdited] = useState(!isNew);
  // Al pasar a "a consultar" el monto se vacía; si se vuelve atrás, se recupera.
  const [lastAmount, setLastAmount] = useState<number | null>(service?.priceAmount ?? null);
  const form = useForm<ServiceInput, unknown, ServiceInputParsed>({
    resolver: zodResolver(serviceInputSchema),
    defaultValues: toFormValues(service, categories[0]?.id ?? 0),
  });
  const { errors, isDirty } = form.formState;
  const guard = useUnsavedChangesGuard(isDirty);
  const [name, slug, description, priceType, priceAmount, currency, priceUnit] = useWatch({
    control: form.control,
    name: ['name', 'slug', 'description', 'priceType', 'priceAmount', 'currency', 'priceUnit'],
  });
  const isQuote = priceType === 'QUOTE';
  const amount = typeof priceAmount === 'number' ? priceAmount : null;
  const pricePreview = formatPrice({
    priceType,
    priceAmount: amount !== null && Number.isFinite(amount) ? amount : null,
    currency,
    priceUnit,
  });

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      if (!slugEdited) form.setValue('slug', slugify(event.target.value));
    },
  });
  const priceTypeField = form.register('priceType', {
    onChange: (event: { target: { value: string } }) => {
      if (event.target.value === 'QUOTE') {
        const current = form.getValues('priceAmount');
        if (typeof current === 'number' && Number.isFinite(current)) setLastAmount(current);
        form.setValue('priceAmount', null);
      } else if (isQuote && form.getValues('priceAmount') === null) {
        // Solo al volver de "a consultar" (`isQuote` es el tipo del último render, el anterior):
        // entre dos tipos con monto, un monto vaciado a propósito queda vacío.
        form.setValue('priceAmount', lastAmount);
      }
    },
  });

  const onSubmit = form.handleSubmit((input) => {
    save.mutate(
      { id: service?.id, input },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? `Servicio "${saved.name}" creado` : 'Cambios guardados');
          guard.allowNavigation();
          void navigate(BACK_TO_LIST);
        },
        onError: (error) => {
          if (!applyFieldErrors(form, FIELDS, error)) {
            notifyError(mutationErrorMessage(error, 'No se pudo guardar el servicio'));
          }
        },
      },
    );
  });

  const businessName = settings.data?.businessName ?? 'tu negocio';
  const globalTemplate = settings.data?.bookingWhatsappTemplate.trim()
    ? settings.data.bookingWhatsappTemplate
    : DEFAULT_BOOKING_WHATSAPP_TEMPLATE;

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <Section title="Datos básicos">
        <FormField id="service-name" label="Nombre" error={errors.name?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...nameField}
              maxLength={SERVICE_NAME_MAX_LENGTH}
              className="h-11"
              autoComplete="off"
            />
          )}
        </FormField>

        <FormField
          id="service-slug"
          label="Slug (para el link)"
          hint={
            isNew
              ? `Se arma solo a partir del nombre: /servicios/${slug || '…'}`
              : 'Cambiarlo rompe los links que ya compartiste (Instagram, WhatsApp).'
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

        <FormField id="service-category" label="Categoría" error={errors.categoryId?.message}>
          {(aria) => (
            <NativeSelect {...aria} {...form.register('categoryId', { valueAsNumber: true })}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive ? '' : ' (oculta)'}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField
          id="service-short-description"
          label="Descripción corta"
          hint="Se ve en las tarjetas del listado. Una o dos oraciones."
          error={errors.shortDescription?.message}
        >
          {(aria) => (
            <Textarea
              {...aria}
              {...form.register('shortDescription')}
              maxLength={SERVICE_SHORT_DESCRIPTION_MAX_LENGTH}
              rows={2}
            />
          )}
        </FormField>
      </Section>

      <Section title="Precio">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="service-price-type"
            label="Tipo de precio"
            error={errors.priceType?.message}
          >
            {(aria) => (
              <NativeSelect {...aria} {...priceTypeField}>
                {(Object.keys(PRICE_TYPE_LABELS) as PriceType[]).map((type) => (
                  <option key={type} value={type}>
                    {PRICE_TYPE_LABELS[type]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          {!isQuote && (
            <FormField id="service-currency" label="Moneda" error={errors.currency?.message}>
              {(aria) => (
                <NativeSelect {...aria} {...form.register('currency')}>
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </NativeSelect>
              )}
            </FormField>
          )}
        </div>

        {!isQuote && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="service-price-amount"
              label="Monto"
              hint="Ej.: 25.000 o 1.500,50"
              error={errors.priceAmount?.message}
            >
              {(aria) => (
                <Controller
                  control={form.control}
                  name="priceAmount"
                  render={({ field }) => (
                    <AmountField
                      {...aria}
                      currency={currency}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                    />
                  )}
                />
              )}
            </FormField>
            <FormField
              id="service-price-unit"
              label="Unidad (opcional)"
              hint='Ej.: "por equipo", "por hora".'
              error={errors.priceUnit?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...form.register('priceUnit')}
                  maxLength={PRICE_UNIT_MAX_LENGTH}
                  className="h-11"
                />
              )}
            </FormField>
          </div>
        )}

        <FormField
          id="service-estimated-time"
          label="Tiempo estimado (opcional)"
          hint='Ej.: "24 a 48 h", "2 semanas".'
          error={errors.estimatedTime?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...form.register('estimatedTime')}
              maxLength={ESTIMATED_TIME_MAX_LENGTH}
              className="h-11"
            />
          )}
        </FormField>

        <p className="text-sm">
          <span className="text-muted-foreground">Así se ve en el sitio: </span>
          <strong>{pricePreview}</strong>
        </p>
      </Section>

      <Section title="Descripción completa">
        <FormField
          id="service-description"
          label="Descripción (markdown)"
          hint="Se muestra en el detalle del servicio. Podés usar **negrita**, listas con - y títulos con ##."
          error={errors.description?.message}
        >
          {(aria) => (
            <MarkdownEditor
              value={description}
              hasError={Boolean(errors.description)}
              textareaProps={{ ...aria, ...form.register('description') }}
            />
          )}
        </FormField>
      </Section>

      <Section title="Mensaje de WhatsApp">
        <Controller
          control={form.control}
          name="whatsappTemplate"
          render={({ field }) => (
            <TemplateField
              id="service-whatsapp-template"
              label='Mensaje para "Reservar turno" (opcional)'
              hint="Dejalo vacío para usar el mensaje general de Configuración."
              error={errors.whatsappTemplate?.message}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              fallback={globalTemplate}
              fallbackLabel="el de Configuración"
              variables={['servicio', 'precio', 'negocio']}
              previewValues={{
                servicio: name || 'Nombre del servicio',
                precio: pricePreview,
                negocio: businessName,
              }}
            />
          )}
        />
      </Section>

      <Section title="Visibilidad">
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary focus-ring"
            {...form.register('isActive')}
          />
          <span>
            <span className="block font-medium">Visible en el sitio</span>
            <span className="text-muted-foreground">
              Si lo desmarcás, queda archivado: no se ve en el sitio pero conserva su historial.
            </span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary focus-ring"
            {...form.register('isFeatured')}
          />
          <span>
            <span className="block font-medium">Destacado</span>
            <span className="text-muted-foreground">Aparece en el inicio del sitio.</span>
          </span>
        </label>
      </Section>

      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild variant="outline" className="min-h-11">
          <Link to={BACK_TO_LIST}>Cancelar</Link>
        </Button>
        <Button type="submit" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : isNew ? 'Crear servicio' : 'Guardar cambios'}
        </Button>
      </div>
      {guard.dialog}
    </form>
  );
}
