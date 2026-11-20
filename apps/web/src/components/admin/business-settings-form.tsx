import { zodResolver } from '@hookform/resolvers/zod';
import {
  ABOUT_TEXT_MAX_LENGTH,
  BUSINESS_NAME_MAX_LENGTH,
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  EMAIL_MAX_LENGTH,
  HERO_SUBTITLE_MAX_LENGTH,
  HERO_TITLE_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  TAGLINE_MAX_LENGTH,
  URL_MAX_LENGTH,
  settingsInputSchema,
  whatsappNumberWarning,
  type AdminSettings,
  type SettingsInput,
  type SettingsInputParsed,
} from '@sch/shared';
import { TriangleExclamationPoint } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_ABOUT_TEXT } from '@/lib/about-text';
import { mutationErrorMessage, useAdminSettings, useSaveSettings } from '@/lib/admin-api';
import { notifyError } from '@/lib/notify';
import { ConfirmDialog } from './confirm-dialog';
import { applyFieldErrors } from './form-errors';
import { FormField } from './form-field';
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

  const onSubmit = form.handleSubmit((input) => {
    // Botón con aria-disabled (no pierde el foco): sin cambios o guardando, no hace nada.
    if (!isDirty || save.isPending) return;
    save.mutate(input, {
      onSuccess: (saved) => {
        // El formulario pasa a reflejar lo guardado (ya normalizado por la API).
        form.reset(toFormValues(saved));
        toast.success('Configuración guardada. Ya se ve en el sitio.');
      },
      onError: (error) => {
        if (!applyFieldErrors(form, FIELDS, error)) {
          notifyError(mutationErrorMessage(error, 'No se pudo guardar la configuración'));
        }
      },
    });
  });

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
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-6">
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

      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:py-3">
        <p
          className="basis-full text-sm text-muted-foreground sm:mr-auto sm:basis-auto"
          aria-live="polite"
        >
          {isDirty ? 'Hay cambios sin guardar' : 'Sin cambios'}
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
      {guard.dialog}
    </form>
  );
}
