import {
  DEVICE_FIELD_MAX_LENGTH,
  JOB_DESCRIPTION_MAX_LENGTH,
  JOB_STATUS_LABELS,
  JOB_TITLE_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  REPORTED_ISSUE_MAX_LENGTH,
  slugify,
  balanceDue,
  dateInputToIso,
  dateTimeInputToIso,
  formatAmount,
  formatDate,
  formatPrice,
  isValidDateInput,
  isValidDateTimeInput,
  isoToDateInput,
  isoToDateTimeInput,
  jobInputSchema,
  todayDateInput,
  type AdminJob,
  type AdminServiceSummary,
  type Currency,
  type JobInput,
  type JobStatus,
  type JobUpdate,
} from '@sch/shared';
import { ArrowLeft, ClipboardList, Laptop, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { AmountField } from '@/components/admin/amount-field';
import { ClientPicker, type ClientOption } from '@/components/admin/client-picker';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { applyFieldErrors } from '@/components/admin/form-errors';
import { FormField } from '@/components/admin/form-field';
import { PaymentBadge } from '@/components/admin/job-badges';
import { JobStatusControl } from '@/components/admin/job-status-control';
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
  useAdminClient,
  useAdminJob,
  useAdminServices,
  useDeleteJob,
  useSaveJob,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { focusMainOnClose } from '@/lib/focus';
import { notifyError } from '@/lib/notify';
import { AdminPageHeader } from './admin-section-page';

const STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[];
const BACK_TO_LIST = '/admin/trabajos';

/** Valores del formulario: las fechas como las usan los inputs (hora argentina). */
interface JobFormValues {
  clientId: number;
  /** Valor del `<select>`: "" = sin servicio del catálogo. */
  serviceId: string;
  title: string;
  description: string;
  device: { brand: string; model: string; serialNumber: string; reportedIssue: string };
  status: JobStatus;
  amountCharged: number | null;
  currency: Currency;
  amountPaid: number | null;
  /** "2026-11-23". */
  receivedAt: string;
  /** "2026-11-23T15:30" o "". */
  scheduledAt: string;
  /** "2026-11-23" o "". */
  completedAt: string;
  internalNotes: string;
}

/** Campo del formulario → campo de la API (para los errores y para mandar solo lo cambiado). */
const FORM_TO_INPUT = {
  clientId: 'clientId',
  serviceId: 'serviceId',
  title: 'title',
  description: 'description',
  device: 'deviceInfo',
  status: 'status',
  amountCharged: 'amountCharged',
  currency: 'currency',
  amountPaid: 'amountPaid',
  receivedAt: 'receivedAt',
  scheduledAt: 'scheduledAt',
  completedAt: 'completedAt',
  internalNotes: 'internalNotes',
} as const satisfies Record<keyof JobFormValues, keyof JobInput>;

const API_FIELDS = (Object.keys(FORM_TO_INPUT) as (keyof JobFormValues)[]).filter(
  (field) => field !== 'device',
) as Exclude<keyof JobFormValues, 'device'>[];

function toFormValues(job: AdminJob | undefined, clientId: number): JobFormValues {
  return {
    clientId: job?.clientId ?? clientId,
    serviceId: job?.serviceId ? String(job.serviceId) : '',
    title: job?.title ?? '',
    description: job?.description ?? '',
    device: {
      brand: job?.deviceInfo?.brand ?? '',
      model: job?.deviceInfo?.model ?? '',
      serialNumber: job?.deviceInfo?.serialNumber ?? '',
      reportedIssue: job?.deviceInfo?.reportedIssue ?? '',
    },
    status: job?.status ?? 'QUOTED',
    amountCharged: job?.amountCharged ?? 0,
    currency: job?.currency ?? 'ARS',
    amountPaid: job?.amountPaid ?? 0,
    receivedAt: job ? isoToDateInput(job.receivedAt) : todayDateInput(),
    scheduledAt: job?.scheduledAt ? isoToDateTimeInput(job.scheduledAt) : '',
    completedAt: job?.completedAt ? isoToDateInput(job.completedAt) : '',
    internalNotes: job?.internalNotes ?? '',
  };
}

/** Pasa las fechas de los inputs a ISO (una fecha inválida queda tal cual: la marca Zod). */
function toJobInput(values: JobFormValues): JobInput {
  const date = (value: string) => (isValidDateInput(value) ? dateInputToIso(value) : value);
  return {
    clientId: values.clientId,
    serviceId: values.serviceId ? Number(values.serviceId) : null,
    title: values.title,
    description: values.description,
    deviceInfo: values.device,
    status: values.status,
    // Vacío = 0 (sin cargo o sin pagos todavía).
    amountCharged: values.amountCharged ?? 0,
    currency: values.currency,
    amountPaid: values.amountPaid ?? 0,
    receivedAt: date(values.receivedAt),
    scheduledAt: values.scheduledAt
      ? isValidDateTimeInput(values.scheduledAt)
        ? dateTimeInputToIso(values.scheduledAt)
        : values.scheduledAt
      : null,
    completedAt: values.completedAt ? date(values.completedAt) : null,
    internalNotes: values.internalNotes,
  };
}

/** Valida con el mismo esquema que la API y ubica cada error en su campo del formulario. */
const jobResolver: Resolver<JobFormValues> = (values) => {
  const result = jobInputSchema.safeParse(toJobInput(values));
  if (result.success) return { values, errors: {} };
  const errors: Record<string, unknown> = {};
  const device: Record<string, unknown> = {};
  for (const issue of result.error.issues) {
    const [field, subfield] = issue.path;
    const error = { type: issue.code, message: issue.message };
    if (field === 'deviceInfo' && typeof subfield === 'string') {
      device[subfield] ??= error;
    } else if (typeof field === 'string') {
      errors[field] ??= error;
    }
  }
  if (Object.keys(device).length > 0) errors.device = device;
  return { values: {}, errors: errors as FieldErrors<JobFormValues> };
};

/** Solo los campos que se tocaron: un cambio de estado hecho aparte no se pisa al guardar. */
function changedFields(
  values: JobFormValues,
  dirty: Partial<Record<keyof JobFormValues, unknown>>,
): JobUpdate {
  const full = toJobInput(values);
  const patch: Record<string, unknown> = {};
  for (const [formKey, inputKey] of Object.entries(FORM_TO_INPUT)) {
    if (dirty[formKey as keyof JobFormValues]) patch[inputKey] = full[inputKey];
  }
  return patch as JobUpdate;
}

/** `/admin/trabajos/nuevo?cliente=<id>` y `/admin/trabajos/:id`. */
export function JobFormPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : undefined;
  const isNew = params.id === undefined;
  const rawClient = searchParams.get('cliente');
  const presetClientId =
    isNew && rawClient && /^[1-9]\d{0,8}$/.test(rawClient) ? Number(rawClient) : undefined;
  const job = useAdminJob(id);
  const presetClient = useAdminClient(presetClientId);
  const services = useAdminServices();
  const backTo = presetClientId ? `/admin/clientes/${presetClientId}` : BACK_TO_LIST;
  // Si se llegó desde un listado (con filtros) o la ficha, "Volver" y "Cancelar" vuelven ahí.
  const origin = originFrom(useLocation().state);
  const exitTo = origin ?? (job.data ? `/admin/clientes/${job.data.clientId}` : backTo);
  const exitLabel = origin
    ? 'Volver'
    : job.data || presetClientId
      ? 'Volver a la ficha del cliente'
      : 'Volver a trabajos';

  let content: ReactNode;
  if ((!isNew && id === undefined) || (job.error instanceof ApiError && job.error.status === 404)) {
    content = (
      <EmptyState
        icon={ClipboardList}
        title="El trabajo no existe"
        description="Puede que lo hayas borrado. Volvé al listado para ver los que hay."
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link to={BACK_TO_LIST}>Ver trabajos</Link>
          </Button>
        }
      />
    );
  } else if (job.isError || services.isError) {
    content = (
      <QueryError
        error={job.error ?? services.error}
        title="No se pudo cargar el formulario"
        onRetry={() => {
          void services.refetch();
          if (id !== undefined) void job.refetch();
        }}
      />
    );
  } else if (
    services.isPending ||
    (!isNew && job.isPending) ||
    (presetClientId !== undefined && presetClient.isPending)
  ) {
    content = (
      <div className="space-y-4" role="status" aria-label="Cargando">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  } else {
    const preset = presetClient.data;
    content = (
      <>
        {job.data && <JobStatusControl job={job.data} />}
        <JobForm
          key={job.data?.id ?? 'new'}
          job={isNew ? undefined : job.data}
          services={services.data}
          initialClient={
            job.data
              ? job.data.client
              : preset
                ? { id: preset.id, fullName: preset.fullName, phone: preset.phone }
                : null
          }
          afterCreate={backTo}
          exitTo={exitTo}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="link" className="-ml-3 min-h-11 px-3">
        <Link to={exitTo}>
          <ArrowLeft aria-hidden="true" />
          {exitLabel}
        </Link>
      </Button>
      <AdminPageHeader
        title={isNew ? 'Nuevo trabajo' : (job.data?.title ?? 'Trabajo')}
        description={job.data ? `Cliente: ${job.data.client.fullName}` : undefined}
      />
      {content}
    </div>
  );
}

/** Ruta interna del panel guardada al navegar (`state.from`); cualquier otra cosa se ignora. */
function originFrom(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && (from === '/admin' || from.startsWith('/admin/'))
    ? from
    : null;
}

/** Sección con encabezado (como "Estado"): se recorre igual con la lista de encabezados. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `job-section-${slugify(title)}`;
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 space-y-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface JobFormProps {
  job: AdminJob | undefined;
  services: AdminServiceSummary[];
  initialClient: ClientOption | null;
  /** A dónde ir después del alta (la ficha del cliente si se vino de ahí). */
  afterCreate: string;
  /** "Cancelar" y después de borrar. */
  exitTo: string;
}

function JobForm({ job, services, initialClient, afterCreate, exitTo }: JobFormProps) {
  const navigate = useNavigate();
  const save = useSaveJob();
  const isNew = job === undefined;
  const [client, setClient] = useState<ClientOption | null>(initialClient);
  const [showDevice, setShowDevice] = useState(Boolean(job?.deviceInfo));
  // Al abrir la sección con el botón, el botón desaparece: el foco va al primer campo.
  const focusDevice = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const form = useForm<JobFormValues>({
    resolver: jobResolver,
    defaultValues: toFormValues(job, initialClient?.id ?? 0),
  });
  const { errors, isDirty } = form.formState;
  const guard = useUnsavedChangesGuard(isDirty);
  const [serviceId, currency, amountCharged, amountPaid] = useWatch({
    control: form.control,
    name: ['serviceId', 'currency', 'amountCharged', 'amountPaid'],
  });

  const servicesById = useMemo(
    () => new Map(services.map((service) => [String(service.id), service])),
    [services],
  );
  const selectedService = servicesById.get(serviceId);
  // Activos agrupados por categoría; el servicio ya asignado se ofrece aunque esté archivado.
  const groups = useMemo(() => {
    const byCategory = new Map<string, AdminServiceSummary[]>();
    for (const service of services) {
      if (!service.isActive && service.id !== job?.serviceId) continue;
      const list = byCategory.get(service.category.name) ?? [];
      list.push(service);
      byCategory.set(service.category.name, list);
    }
    return [...byCategory.entries()];
  }, [services, job?.serviceId]);

  // Un cambio de estado aparte puede completar la fecha de terminado: se muestra si el campo
  // no se estaba editando.
  const savedCompletedAt = job?.completedAt ?? null;
  useEffect(() => {
    if (!form.getFieldState('completedAt').isDirty) {
      form.resetField('completedAt', {
        defaultValue: savedCompletedAt ? isoToDateInput(savedCompletedAt) : '',
      });
    }
  }, [form, savedCompletedAt]);

  useEffect(() => {
    if (showDevice && focusDevice.current) {
      focusDevice.current = false;
      form.setFocus('device.brand');
    }
  }, [form, showDevice]);

  const serviceField = form.register('serviceId', {
    onChange: (event: { target: { value: string } }) => {
      const previous = selectedService;
      const next = servicesById.get(event.target.value);
      if (!next) return;
      // Se precarga el precio del catálogo (editable); "a consultar" no trae monto.
      if (next.priceType !== 'QUOTE' && next.priceAmount !== null) {
        form.setValue('amountCharged', next.priceAmount, { shouldDirty: true });
        form.setValue('currency', next.currency, { shouldDirty: true });
      }
      const title = form.getValues('title').trim();
      if (!title || title === previous?.name) {
        form.setValue('title', next.name, { shouldDirty: true, shouldValidate: Boolean(title) });
      }
      if (next.category.line === 'TECH_SUPPORT') setShowDevice(true);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const input = isNew
      ? toJobInput(values)
      : changedFields(
          values,
          form.formState.dirtyFields as Partial<Record<keyof JobFormValues, unknown>>,
        );
    save.mutate(
      { id: job?.id, input },
      {
        onSuccess: (saved) => {
          if (isNew) {
            toast.success('Trabajo registrado');
            guard.allowNavigation();
            void navigate(afterCreate);
          } else {
            toast.success('Cambios guardados');
            form.reset(toFormValues(saved, saved.clientId));
          }
        },
        onError: (error) => {
          if (!applyFieldErrors(form, API_FIELDS, error)) {
            notifyError(mutationErrorMessage(error, 'No se pudo guardar el trabajo'));
          }
        },
      },
    );
  });

  const paid = Number.isFinite(amountPaid) ? (amountPaid ?? 0) : 0;
  const charged = Number.isFinite(amountCharged) ? (amountCharged ?? 0) : 0;
  const due = balanceDue(charged, paid);
  const snapshotPrice =
    job?.servicePriceTypeSnapshot &&
    formatPrice({
      priceType: job.servicePriceTypeSnapshot,
      priceAmount: job.servicePriceSnapshot,
      currency: job.serviceCurrencySnapshot ?? job.currency,
    });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <Section title="Cliente">
        <FormField id="job-client" label="Elegí el cliente" error={errors.clientId?.message}>
          {(aria) => (
            <Controller
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <ClientPicker
                  {...aria}
                  inputRef={field.ref}
                  showInitialResults
                  value={client}
                  allowCreate={isNew}
                  onChange={(next) => {
                    setClient(next);
                    field.onChange(next?.id ?? 0);
                  }}
                />
              )}
            />
          )}
        </FormField>
      </Section>

      <Section title="Trabajo">
        <FormField
          id="job-service"
          label="Servicio del catálogo (opcional)"
          hint={
            selectedService
              ? `Precio actual: ${formatPrice(selectedService)}. Al elegirlo se precarga el total.`
              : 'Al elegir un servicio se precargan el título y el total (los podés cambiar).'
          }
          error={errors.serviceId?.message}
        >
          {(aria) => (
            <NativeSelect {...aria} {...serviceField}>
              <option value="">Sin servicio del catálogo</option>
              {groups.map(([category, list]) => (
                <optgroup key={category} label={category}>
                  {list.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                      {service.isActive ? '' : ' (archivado)'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          )}
        </FormField>
        {job?.serviceNameSnapshot && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
            Registrado como <strong>{job.serviceNameSnapshot}</strong>
            {snapshotPrice && ` (${snapshotPrice} al asignarlo)`}
            {!job.serviceId && '. El servicio ya no está en el catálogo.'}
          </p>
        )}

        <FormField id="job-title" label="Título" error={errors.title?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...form.register('title')}
              maxLength={JOB_TITLE_MAX_LENGTH}
              autoComplete="off"
              className="h-11"
            />
          )}
        </FormField>
        <FormField
          id="job-description"
          label="Descripción (opcional)"
          hint="Qué se hizo o qué se pidió."
          error={errors.description?.message}
        >
          {(aria) => (
            <Textarea
              {...aria}
              {...form.register('description')}
              maxLength={JOB_DESCRIPTION_MAX_LENGTH}
              rows={3}
            />
          )}
        </FormField>
        {isNew && (
          <FormField id="job-status" label="Estado" error={errors.status?.message}>
            {(aria) => (
              <NativeSelect {...aria} {...form.register('status')}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {JOB_STATUS_LABELS[status]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
      </Section>

      {showDevice ? (
        <Section title="Equipo">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="job-brand" label="Marca" error={errors.device?.brand?.message}>
              {(aria) => (
                <Input
                  {...aria}
                  {...form.register('device.brand')}
                  maxLength={DEVICE_FIELD_MAX_LENGTH}
                  autoComplete="off"
                  className="h-11"
                />
              )}
            </FormField>
            <FormField id="job-model" label="Modelo" error={errors.device?.model?.message}>
              {(aria) => (
                <Input
                  {...aria}
                  {...form.register('device.model')}
                  maxLength={DEVICE_FIELD_MAX_LENGTH}
                  autoComplete="off"
                  className="h-11"
                />
              )}
            </FormField>
            <FormField
              id="job-serial"
              label="N° de serie"
              error={errors.device?.serialNumber?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...form.register('device.serialNumber')}
                  maxLength={DEVICE_FIELD_MAX_LENGTH}
                  autoComplete="off"
                  className="h-11"
                />
              )}
            </FormField>
          </div>
          <FormField
            id="job-issue"
            label="Falla reportada"
            error={errors.device?.reportedIssue?.message}
          >
            {(aria) => (
              <Textarea
                {...aria}
                {...form.register('device.reportedIssue')}
                maxLength={REPORTED_ISSUE_MAX_LENGTH}
                rows={3}
              />
            )}
          </FormField>
        </Section>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            focusDevice.current = true;
            setShowDevice(true);
          }}
        >
          <Laptop aria-hidden="true" />
          Agregar datos del equipo
        </Button>
      )}

      <Section title="Fechas">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="job-received"
            label="Ingreso"
            hint="Cuándo llegó el equipo o el pedido."
            error={errors.receivedAt?.message}
          >
            {(aria) => (
              <Input {...aria} {...form.register('receivedAt')} type="date" className="h-11" />
            )}
          </FormField>
          <FormField
            id="job-scheduled"
            label="Turno (opcional)"
            error={errors.scheduledAt?.message}
          >
            {(aria) => (
              <Input
                {...aria}
                {...form.register('scheduledAt')}
                type="datetime-local"
                className="h-11"
              />
            )}
          </FormField>
          <FormField
            id="job-completed"
            label="Terminado (opcional)"
            hint="Al pasar a Terminado se completa con la fecha de ese día."
            error={errors.completedAt?.message}
          >
            {(aria) => (
              <Input {...aria} {...form.register('completedAt')} type="date" className="h-11" />
            )}
          </FormField>
        </div>
      </Section>

      <Section title="Cobro">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="job-currency" label="Moneda" error={errors.currency?.message}>
            {(aria) => (
              <NativeSelect {...aria} {...form.register('currency')}>
                <option value="ARS">Pesos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id="job-amount-charged"
            label={`Total (${currency})`}
            hint="Ej.: 25.000 o 1.500,50"
            error={errors.amountCharged?.message}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name="amountCharged"
                render={({ field }) => (
                  <AmountField
                    {...aria}
                    currency={currency}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                  />
                )}
              />
            )}
          </FormField>
          <FormField
            id="job-amount-paid"
            label={`Pagado (${currency})`}
            hint="Lo cobrado hasta ahora."
            error={errors.amountPaid?.message}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <AmountField
                    {...aria}
                    currency={currency}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                  />
                )}
              />
            )}
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Solo el resumen se anuncia (no el botón). */}
          <p className="flex flex-wrap items-center gap-3" aria-live="polite" aria-atomic="true">
            <PaymentBadge amountCharged={charged} amountPaid={paid} />
            {due > 0 && (
              <span className="tabular-nums">
                Saldo: <strong>{formatAmount(due, currency)}</strong>
              </span>
            )}
          </p>
          {due > 0 && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                form.setValue('amountPaid', charged, { shouldDirty: true, shouldValidate: true });
                // El botón desaparece (ya no hay saldo): el foco va al campo "Pagado".
                form.setFocus('amountPaid');
              }}
            >
              Marcar como pagado
            </Button>
          )}
        </div>
      </Section>

      <Section title="Notas internas">
        <FormField
          id="job-notes"
          label="Notas para vos (opcional)"
          hint="Solo las ves vos: repuestos usados, pendientes, acuerdos con el cliente, etc."
          error={errors.internalNotes?.message}
        >
          {(aria) => (
            <Textarea
              {...aria}
              {...form.register('internalNotes')}
              maxLength={NOTES_MAX_LENGTH}
              rows={3}
            />
          )}
        </FormField>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {job ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Borrar trabajo
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="min-h-11">
            <Link to={exitTo}>Cancelar</Link>
          </Button>
          <Button type="submit" className="min-h-11" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : isNew ? 'Registrar trabajo' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
      {job && (
        <DeleteJobDialog
          job={job}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          exitTo={exitTo}
          onDeleted={() => guard.allowNavigation()}
        />
      )}
      {guard.dialog}
    </form>
  );
}

function DeleteJobDialog({
  job,
  open,
  onOpenChange,
  onDeleted,
  exitTo,
}: {
  job: AdminJob;
  exitTo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const remove = useDeleteJob();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title="¿Borrar este trabajo?"
      description={
        <p>
          Se borra <strong>{job.title}</strong> ({job.client.fullName}, ingreso{' '}
          {formatDate(job.receivedAt)}) con sus cobros y notas. No se puede deshacer.
        </p>
      }
      confirmLabel="Borrar trabajo"
      pendingLabel="Borrando…"
      pending={remove.isPending}
      error={remove.error ? mutationErrorMessage(remove.error, 'No se pudo borrar') : null}
      onCloseAutoFocus={remove.isSuccess ? focusMainOnClose : undefined}
      onConfirm={() =>
        remove.mutate(job.id, {
          onSuccess: () => {
            toast.success('Trabajo borrado');
            onDeleted();
            void navigate(exitTo, { replace: true });
          },
        })
      }
    />
  );
}
