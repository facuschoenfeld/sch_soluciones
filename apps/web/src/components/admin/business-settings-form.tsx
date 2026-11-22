import { zodResolver } from '@hookform/resolvers/zod';
import {
  ABOUT_TEXT_MAX_LENGTH,
  BUSINESS_NAME_MAX_LENGTH,
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  HERO_SUBTITLE_MAX_LENGTH,
  HERO_TITLE_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  TAGLINE_MAX_LENGTH,
  URL_MAX_LENGTH,
  contactSettingsChanged,
  settingsInputSchema,
  whatsappNumberWarning,
  type AdminSettings,
  type SettingsInput,
  type SettingsInputParsed,
} from '@sch/shared';
import { TriangleExclamationPoint } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { QueryError } from '@/components/feedback/query-error';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_ABOUT_TEXT } from '@/lib/about-text';
import {
  mutationErrorMessage,
  refetchAdminSettings,
  useAdminSettings,
  useSaveSettings,
} from '@/lib/admin-api';
import { ApiError, fieldErrors } from '@/lib/api-client';
import { notifyError } from '@/lib/notify';
import { avoidToasts } from '@/lib/toast-clearance';
import { ConfirmDialog } from './confirm-dialog';
import { applyFieldErrors } from './form-errors';
import { FormField, PasswordInput } from './form-field';
import { TemplateField } from './template-field';
import { useUnsavedChangesGuard } from './unsaved-changes-guard';

const FIELDS = [
  'businessName',
  'tagline',
  'whatsappNumber',
  'bookingWhatsappTemplate',
  'inquiryWhatsappTemplate',
  'generalWhatsappTemplate',
  'heroTitle',
  'heroSubtitle',
  'aboutText',
  'businessHours',
  'serviceArea',
  'instagramUrl',
  'githubUrl',
  'linkedinUrl',
  'email',
] as const satisfies readonly Path<SettingsInput>[];

/** Los null de la API se muestran como campos vacíos. */
function toFormValues(settings: AdminSettings): SettingsInput {
  return {
    ...settings,
    tagline: settings.tagline ?? '',
    heroSubtitle: settings.heroSubtitle ?? '',
    aboutText: settings.aboutText ?? '',
    businessHours: settings.businessHours ?? '',
    serviceArea: settings.serviceArea ?? '',
    instagramUrl: settings.instagramUrl ?? '',
    githubUrl: settings.githubUrl ?? '',
    linkedinUrl: settings.linkedinUrl ?? '',
    email: settings.email ?? '',
  };
}

/** Datos del negocio y mensajes de WhatsApp (Settings). */
export function BusinessSettingsSection() {
  const settings = useAdminSettings();

  return (
    <section aria-labelledby="negocio-titulo" className="space-y-4">
      <div className="space-y-1">
        <h2 id="negocio-titulo" className="text-xl font-semibold">
          Datos del negocio
        </h2>
        <p className="text-sm text-muted-foreground">
          Lo que se ve en el sitio: nombre, textos del inicio, contacto y mensajes de WhatsApp.
        </p>
      </div>

      {settings.isPending && (
        <div className="space-y-4" role="status" aria-label="Cargando la configuración">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      )}
      {settings.isError && (
        <QueryError
          error={settings.error}
          title="No se pudo cargar la configuración"
          onRetry={() => void settings.refetch()}
        />
      )}
      {settings.data && <BusinessSettingsForm settings={settings.data} />}
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <h3 id={headingId} className="text-lg font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function BusinessSettingsForm({ settings }: { settings: AdminSettings }) {
  const save = useSaveSettings();
  const form = useForm<SettingsInput, unknown, SettingsInputParsed>({
    resolver: zodResolver(settingsInputSchema),
    defaultValues: toFormValues(settings),
  });
  const { errors, isDirty } = form.formState;
  const guard = useUnsavedChangesGuard(isDirty);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const queryClient = useQueryClient();
  // Cambios de contacto a la espera de la contraseña (null = diálogo cerrado).
  const [pendingContact, setPendingContact] = useState<PendingContact | null>(null);
  // `attempt` cambia en cada error: el diálogo vuelve a enfocar el campo aunque el texto se repita.
  const [passwordError, setPasswordError] = useState<{ message: string; attempt: number } | null>(
    null,
  );
  const [businessName = '', whatsappNumber = ''] = useWatch({
    control: form.control,
    name: ['businessName', 'whatsappNumber'],
  });
  const numberWarning = whatsappNumberWarning(whatsappNumber.replace(/[\s()+-]/g, ''));
  const previewValues = {
    servicio: 'Instalación de Windows',
    precio: '$ 25.000',
    negocio: businessName.trim() || settings.businessName,
  };

  const askPassword = (input: SettingsInputParsed) => {
    setPasswordError(null);
    setPendingContact({ input, fields: changedContactFields(settings, input) });
  };

  const showPasswordError = (message: string) =>
    setPasswordError((current) => ({ message, attempt: (current?.attempt ?? 0) + 1 }));

  const saveSettings = (input: SettingsInputParsed, currentPassword?: string) => {
    // React procesa el re-render de un clic antes del siguiente: con isPending alcanza para no
    // mandar dos veces (un intento de más contaría como fallo en el límite de contraseñas).
    if (save.isPending) return;
    // Los campos no se bloquean mientras guarda (perderían el foco): si se siguió escribiendo,
    // el reset posterior conserva esas ediciones como cambios pendientes.
    const submitted = form.getValues();
    save.mutate(
      { ...input, currentPassword },
      {
        onSuccess: (saved) => {
          setPendingContact(null);
          const current = form.getValues();
          // El formulario pasa a reflejar lo guardado (ya normalizado por la API)...
          form.reset(toFormValues(saved));
          // ...salvo los campos que se editaron después de enviar: esos quedan como cambios
          // pendientes (solo esos; lo enviado se ve normalizado).
          for (const field of FIELDS) {
            if (current[field] !== submitted[field]) {
              form.setValue(field, current[field], { shouldDirty: true });
            }
          }
          toast.success('Configuración guardada. Ya se ve en el sitio.');
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            // El contacto se cambió desde otro dispositivo (esta pestaña tenía el anterior y no
            // lo tocó). Pedir la contraseña acá revertiría ese cambio: se toma el contacto
            // guardado y se avisa para que revise y vuelva a guardar.
            if (error.code === 'CURRENT_PASSWORD_REQUIRED') {
              setPendingContact(null);
              void refetchAdminSettings(queryClient)
                .then((fresh) => {
                  const values = toFormValues(fresh);
                  form.resetField('whatsappNumber', { defaultValue: values.whatsappNumber });
                  form.resetField('email', { defaultValue: values.email });
                  notifyError(
                    'El número de WhatsApp o el email se cambiaron desde otro dispositivo. Ya los actualizamos acá: revisá y guardá de nuevo.',
                  );
                })
                .catch(() =>
                  notifyError('No se pudo guardar. Recargá la página e intentá de nuevo.'),
                );
              return;
            }
            // Los errores de la contraseña se muestran en su diálogo, que queda abierto.
            if (currentPassword !== undefined) {
              const fieldMessage = fieldErrors(error).currentPassword;
              if (error.status === 429) {
                showPasswordError('Demasiados intentos. Esperá unos minutos y probá de nuevo.');
                return;
              }
              if (error.code === 'INVALID_CURRENT_PASSWORD' || fieldMessage) {
                showPasswordError(fieldMessage ?? error.message);
                return;
              }
            }
          }
          setPendingContact(null);
          if (!applyFieldErrors(form, FIELDS, error)) {
            notifyError(mutationErrorMessage(error, 'No se pudo guardar la configuración'));
          }
        },
      },
    );
  };

  const validateAndSave = form.handleSubmit((input) => {
    // Cambiar a dónde llegan los clientes pide la contraseña (lo exige también la API).
    if (contactSettingsChanged(settings, input)) {
      askPassword(input);
      return;
    }
    saveSettings(input);
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Botón con aria-disabled (no pierde el foco): sin cambios o guardando, no hace nada (ni
    // siquiera valida).
    if (!isDirty || save.isPending) {
      event.preventDefault();
      return;
    }
    void validateAndSave(event);
  };

  const text = (
    name: (typeof FIELDS)[number],
    label: string,
    maxLength: number,
    extra: { hint?: string; type?: string; autoComplete?: string } = {},
  ) => (
    <FormField
      id={`settings-${name}`}
      label={label}
      hint={extra.hint}
      error={errors[name]?.message}
    >
      {(aria) => (
        <Input
          {...aria}
          {...form.register(name)}
          type={extra.type ?? 'text'}
          autoComplete={extra.autoComplete ?? 'off'}
          maxLength={maxLength}
          className="h-11"
        />
      )}
    </FormField>
  );

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.isPending} className="space-y-6">
      <Card title="Negocio">
        {text('businessName', 'Nombre del negocio', BUSINESS_NAME_MAX_LENGTH)}
        {text('tagline', 'Frase corta (opcional)', TAGLINE_MAX_LENGTH, {
          hint: 'Aparece en "Sobre mí" y en el pie del sitio.',
        })}
      </Card>

      <Card title="Inicio del sitio">
        {text('heroTitle', 'Título principal', HERO_TITLE_MAX_LENGTH)}
        <FormField
          id="settings-heroSubtitle"
          label="Subtítulo (opcional)"
          error={errors.heroSubtitle?.message}
        >
          {(aria) => (
            <Textarea
              {...aria}
              {...form.register('heroSubtitle')}
              maxLength={HERO_SUBTITLE_MAX_LENGTH}
              rows={2}
            />
          )}
        </FormField>
      </Card>

      <Card title="Sobre mí">
        <FormField
          id="settings-aboutText"
          label="Texto de la página de contacto (opcional)"
          hint="Separá los párrafos con una línea en blanco. Si lo dejás vacío se muestra un texto genérico."
          error={errors.aboutText?.message}
        >
          {(aria) => (
            <Textarea
              {...aria}
              {...form.register('aboutText')}
              maxLength={ABOUT_TEXT_MAX_LENGTH}
              placeholder={DEFAULT_ABOUT_TEXT}
              rows={5}
            />
          )}
        </FormField>
      </Card>

      <Card title="Contacto">
        <div className="space-y-2">
          {text('whatsappNumber', 'Número de WhatsApp', 20, {
            type: 'tel',
            hint: 'Con código de país y sin el +. Celular de Argentina: 549 + código de área sin 0 + número sin 15 (ej. 5491122334455).',
          })}
          {/* La región queda siempre montada: si aparece ya con texto, no se anuncia. */}
          <div role="status">
            {numberWarning && !errors.whatsappNumber && (
              <p className="flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {numberWarning}
              </p>
            )}
          </div>
        </div>
        {text('email', 'Email (opcional)', EMAIL_MAX_LENGTH, {
          type: 'email',
          autoComplete: 'email',
        })}
        {text('businessHours', 'Horarios (opcional)', SHORT_TEXT_MAX_LENGTH, {
          hint: 'Ej.: "Lunes a viernes de 9 a 18 h".',
        })}
        {text('serviceArea', 'Zona de atención (opcional)', SHORT_TEXT_MAX_LENGTH)}
      </Card>

      <Card title="Redes (opcional)">
        {text('instagramUrl', 'Instagram', URL_MAX_LENGTH, {
          type: 'url',
          hint: 'Link completo, ej.: https://instagram.com/tu_usuario',
        })}
        {text('githubUrl', 'GitHub', URL_MAX_LENGTH, { type: 'url' })}
        {text('linkedinUrl', 'LinkedIn', URL_MAX_LENGTH, { type: 'url' })}
      </Card>

      <Card title="Mensajes de WhatsApp">
        <p className="text-sm text-muted-foreground">
          Es el texto que le aparece armado al visitante (lo puede editar antes de enviarlo). Un
          servicio puede tener su propio mensaje de reserva.
        </p>
        <Controller
          control={form.control}
          name="bookingWhatsappTemplate"
          render={({ field }) => (
            <TemplateField
              id="settings-booking-template"
              label='"Reservar turno"'
              error={errors.bookingWhatsappTemplate?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              fallback={DEFAULT_BOOKING_WHATSAPP_TEMPLATE}
              fallbackLabel="el de fábrica"
              variables={['servicio', 'precio', 'negocio']}
              previewValues={previewValues}
            />
          )}
        />
        <Controller
          control={form.control}
          name="inquiryWhatsappTemplate"
          render={({ field }) => (
            <TemplateField
              id="settings-inquiry-template"
              label='"Hacer una consulta"'
              error={errors.inquiryWhatsappTemplate?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              fallback={DEFAULT_INQUIRY_WHATSAPP_TEMPLATE}
              fallbackLabel="el de fábrica"
              variables={['servicio', 'precio', 'negocio']}
              previewValues={previewValues}
            />
          )}
        />
        <Controller
          control={form.control}
          name="generalWhatsappTemplate"
          render={({ field }) => (
            <TemplateField
              id="settings-general-template"
              label="General (botón flotante y contacto)"
              hint="No se refiere a un servicio puntual: solo admite {{negocio}}."
              error={errors.generalWhatsappTemplate?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              fallback={DEFAULT_GENERAL_WHATSAPP_TEMPLATE}
              fallbackLabel="el de fábrica"
              variables={['negocio']}
              // Sin servicio puntual: la vista previa muestra lo mismo que verá el visitante.
              previewValues={{ negocio: previewValues.negocio }}
            />
          )}
        />
      </Card>

      <div
        ref={avoidToasts}
        className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:py-3"
      >
        <p
          className="basis-full text-sm text-muted-foreground sm:mr-auto sm:basis-auto"
          aria-live="polite"
        >
          {save.isPending ? 'Guardando…' : isDirty ? 'Hay cambios sin guardar' : 'Sin cambios'}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          aria-disabled={!isDirty || save.isPending}
          onClick={() => isDirty && !save.isPending && setConfirmDiscard(true)}
        >
          Descartar
        </Button>
        <Button type="submit" className="min-h-11" aria-disabled={!isDirty || save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="¿Descartar los cambios?"
        description={<p>El formulario vuelve a lo último que guardaste.</p>}
        confirmLabel="Descartar"
        onConfirm={() => {
          form.reset();
          setConfirmDiscard(false);
        }}
      />
      <ContactPasswordDialog
        pendingContact={pendingContact}
        pending={save.isPending}
        error={passwordError}
        onClearError={() => setPasswordError(null)}
        onCancel={() => setPendingContact(null)}
        onConfirm={(password) => {
          if (pendingContact) saveSettings(pendingContact.input, password);
        }}
        // Al cancelar, el foco vuelve al dato de contacto que se cambió.
        focusChangedField={(field) => form.setFocus(field)}
      />
      {guard.dialog}
    </form>
  );
}

type ContactField = 'whatsappNumber' | 'email';

interface PendingContact {
  input: SettingsInputParsed;
  fields: ContactField[];
}

function changedContactFields(
  before: Pick<AdminSettings, ContactField>,
  after: Pick<SettingsInputParsed, ContactField>,
): ContactField[] {
  return (['whatsappNumber', 'email'] as const).filter((field) => before[field] !== after[field]);
}

function describeChange(fields: ContactField[]): string {
  if (fields.length === 1 && fields[0] === 'whatsappNumber') return 'el número de WhatsApp';
  if (fields.length === 1 && fields[0] === 'email') return 'el email';
  return 'el número de WhatsApp y el email';
}

interface ContactPasswordDialogProps {
  pendingContact: PendingContact | null;
  pending: boolean;
  error: { message: string; attempt: number } | null;
  onClearError: () => void;
  onCancel: () => void;
  onConfirm: (password: string) => void;
  focusChangedField: (field: ContactField) => void;
}

/** Confirmación con la contraseña antes de cambiar el número de WhatsApp o el email. */
function ContactPasswordDialog({
  pendingContact,
  pending,
  error,
  onClearError,
  onCancel,
  onConfirm,
  focusChangedField,
}: ContactPasswordDialogProps) {
  // Se recuerda el último pedido para que el texto no cambie durante la animación de cierre.
  const [shown, setShown] = useState(pendingContact);
  if (pendingContact && pendingContact !== shown) setShown(pendingContact);
  const cancelled = useRef(false);
  const what = describeChange(shown?.fields ?? []);

  const cancel = () => {
    if (pending) return;
    cancelled.current = true;
    onCancel();
  };
  // Mientras guarda no se cierra (Escape, clic afuera): un error no tendría dónde mostrarse.
  const blockWhilePending = (event: Event) => {
    if (pending) event.preventDefault();
  };

  return (
    <Dialog open={pendingContact !== null} onOpenChange={(next) => !next && cancel()}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!pending}
        onEscapeKeyDown={blockWhilePending}
        onInteractOutside={blockWhilePending}
        onOpenAutoFocus={() => {
          cancelled.current = false;
        }}
        onCloseAutoFocus={(event) => {
          const field = shown?.fields[0];
          if (cancelled.current && field) {
            event.preventDefault();
            focusChangedField(field);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Confirmá con tu contraseña</DialogTitle>
          <DialogDescription>
            Cambiaste {what}, que es por donde te contactan los clientes. Por seguridad, ingresá tu
            contraseña para guardar el cambio.
          </DialogDescription>
        </DialogHeader>
        {/* Se monta en cada apertura: el campo arranca vacío. */}
        <ContactPasswordForm
          pending={pending}
          error={error}
          onClearError={onClearError}
          onCancel={cancel}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

function ContactPasswordForm({
  pending,
  error,
  onClearError,
  onCancel,
  onConfirm,
}: Pick<ContactPasswordDialogProps, 'pending' | 'error' | 'onClearError' | 'onConfirm'> & {
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [emptyError, setEmptyError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tras un error (contraseña incorrecta, demasiados intentos) el foco vuelve al campo, con el
  // texto seleccionado para reescribirlo.
  useEffect(() => {
    if (!error) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [error]);

  // Formulario propio (no anidado en el de Configuración: el diálogo se renderiza en un portal).
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // En React los eventos atraviesan el portal: sin esto, el submit llegaría también al
    // formulario de Configuración.
    event.stopPropagation();
    if (pending) return;
    if (!password) {
      setEmptyError(true);
      return;
    }
    onConfirm(password);
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormField
        id="contact-current-password"
        label="Contraseña actual"
        error={emptyError ? 'Ingresá tu contraseña' : error?.message}
      >
        {(aria) => (
          <PasswordInput
            {...aria}
            ref={inputRef}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setEmptyError(false);
              if (error) onClearError();
            }}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="current-password"
            autoFocus
          />
        )}
      </FormField>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" aria-disabled={pending}>
          {pending ? 'Guardando…' : 'Confirmar y guardar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
