import { zodResolver } from '@hookform/resolvers/zod';
import {
  ADDRESS_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_SOURCE_LABELS,
  EMAIL_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  clientInputSchema,
  type AdminClientDetail,
  type ClientInput,
  type ClientInputParsed,
  type ClientSource,
} from '@sch/shared';
import { ArrowLeft, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { applyFieldErrors } from '@/components/admin/form-errors';
import { FormField } from '@/components/admin/form-field';
import { useUnsavedChangesGuard } from '@/components/admin/unsaved-changes-guard';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { mutationErrorMessage, useAdminClient, useSaveClient } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { clientPhoneWarning } from '@/lib/client-phone';
import { notifyError } from '@/lib/notify';
import { AdminPageHeader } from './admin-section-page';

const FIELDS = ['fullName', 'phone', 'email', 'address', 'source', 'notes'] as const;

function toFormValues(client: AdminClientDetail | undefined): ClientInput {
  return {
    fullName: client?.fullName ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    source: client?.source ?? 'WHATSAPP',
    notes: client?.notes ?? '',
  };
}

/** `/admin/clientes/nuevo` y `/admin/clientes/:id/editar`. */
export function ClientFormPage() {
  const params = useParams();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : undefined;
  const isNew = params.id === undefined;
  const client = useAdminClient(id);
  // Desde el alta de un trabajo ("¿No está? Crear cliente"), "Volver" y "Cancelar" vuelven ahí.
  const [searchParams] = useSearchParams();
  const returnToJob = isNew && searchParams.get('volver') === 'trabajo';
  const backTo = returnToJob
    ? '/admin/trabajos/nuevo'
    : isNew || id === undefined
      ? '/admin/clientes'
      : `/admin/clientes/${id}`;

  let content: ReactNode;
  if (
    (!isNew && id === undefined) ||
    (client.error instanceof ApiError && client.error.status === 404)
  ) {
    content = (
      <EmptyState
        icon={Users}
        title="El cliente no existe"
        description="Puede que lo hayas borrado. Volvé al listado para ver los que hay."
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/admin/clientes">Ver clientes</Link>
          </Button>
        }
      />
    );
  } else if (client.isError) {
    content = (
      <QueryError
        error={client.error}
        title="No se pudo cargar el cliente"
        onRetry={() => void client.refetch()}
      />
    );
  } else if (!isNew && client.isPending) {
    content = <Skeleton className="h-96 rounded-xl" role="status" aria-label="Cargando" />;
  } else {
    content = <ClientForm client={isNew ? undefined : client.data} backTo={backTo} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="link" className="-ml-3 min-h-11 px-3">
        <Link to={backTo}>
          <ArrowLeft aria-hidden="true" />
          {returnToJob ? 'Volver al trabajo' : isNew ? 'Volver a clientes' : 'Volver a la ficha'}
        </Link>
      </Button>
      <AdminPageHeader
        title={isNew ? 'Nuevo cliente' : 'Editar cliente'}
        description={isNew ? undefined : client.data?.fullName}
      />
      {content}
    </div>
  );
}

function ClientForm({ client, backTo }: { client: AdminClientDetail | undefined; backTo: string }) {
  const navigate = useNavigate();
  // Desde el alta de un trabajo ("¿No está? Crear cliente"): al crearlo se vuelve a ese alta.
  const [searchParams] = useSearchParams();
  const returnToJob = searchParams.get('volver') === 'trabajo';
  const save = useSaveClient();
  const isNew = client === undefined;
  const form = useForm<ClientInput, unknown, ClientInputParsed>({
    resolver: zodResolver(clientInputSchema),
    defaultValues: toFormValues(client),
  });
  const { errors, isDirty } = form.formState;
  const guard = useUnsavedChangesGuard(isDirty);
  const phone = useWatch({ control: form.control, name: 'phone' });
  const phoneWarning = errors.phone ? null : clientPhoneWarning(phone);

  const onSubmit = form.handleSubmit((input) => {
    save.mutate(
      { id: client?.id, input },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? `Cliente "${saved.fullName}" creado` : 'Cambios guardados');
          guard.allowNavigation();
          void navigate(
            isNew && returnToJob
              ? `/admin/trabajos/nuevo?cliente=${saved.id}`
              : `/admin/clientes/${saved.id}`,
            { replace: isNew },
          );
        },
        onError: (error) => {
          if (!applyFieldErrors(form, FIELDS, error)) {
            notifyError(mutationErrorMessage(error, 'No se pudo guardar el cliente'));
          }
        },
      },
    );
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-6 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <FormField id="client-name" label="Nombre y apellido" error={errors.fullName?.message}>
        {(aria) => (
          <Input
            {...aria}
            {...form.register('fullName')}
            maxLength={CLIENT_NAME_MAX_LENGTH}
            autoComplete="off"
            className="h-11"
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="client-phone"
          label="Teléfono"
          hint={
            phoneWarning ?? 'Con código de país para escribirle por WhatsApp (ej. 5491122334455).'
          }
          hintTone={phoneWarning ? 'warning' : 'muted'}
          error={errors.phone?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...form.register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className="h-11 tabular-nums"
            />
          )}
        </FormField>
        <FormField id="client-email" label="Email (opcional)" error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...form.register('email')}
              type="email"
              maxLength={EMAIL_MAX_LENGTH}
              autoComplete="off"
              className="h-11"
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="client-address" label="Dirección (opcional)" error={errors.address?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...form.register('address')}
              maxLength={ADDRESS_MAX_LENGTH}
              autoComplete="off"
              className="h-11"
            />
          )}
        </FormField>
        <FormField id="client-source" label="¿Cómo llegó?" error={errors.source?.message}>
          {(aria) => (
            <NativeSelect {...aria} {...form.register('source')}>
              {(Object.keys(CLIENT_SOURCE_LABELS) as ClientSource[]).map((source) => (
                <option key={source} value={source}>
                  {CLIENT_SOURCE_LABELS[source]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>

      <FormField
        id="client-notes"
        label="Notas (opcional)"
        hint="Solo las ves vos: preferencias, horarios, equipos que tiene, etc."
        error={errors.notes?.message}
      >
        {(aria) => (
          <Textarea {...aria} {...form.register('notes')} maxLength={NOTES_MAX_LENGTH} rows={4} />
        )}
      </FormField>

      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild variant="outline" className="min-h-11">
          <Link to={backTo}>Cancelar</Link>
        </Button>
        <Button type="submit" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : isNew ? 'Crear cliente' : 'Guardar cambios'}
        </Button>
      </div>
      {guard.dialog}
    </form>
  );
}
