import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, newPasswordSchema } from '@sch/shared';
import { CircleCheck, KeyRound, LogOut, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, PasswordInput } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ApiError, fieldErrors } from '@/lib/api-client';
import { useChangePassword, useLogoutAll, useSession } from '@/lib/auth';
import { AdminPageHeader } from './admin-section-page';

// Mismas reglas que la API (changePasswordSchema) más la confirmación, que es solo de UX.
const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual').max(PASSWORD_MAX_LENGTH),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'La nueva contraseña tiene que ser distinta de la actual',
      });
    }
    if (value.confirmPassword !== value.newPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Las contraseñas no coinciden',
      });
    }
  });
type FormValues = z.infer<typeof formSchema>;

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <AdminPageHeader
        title="Configuración"
        description="Cambiá tu contraseña. Los datos del negocio y los mensajes de WhatsApp se van a poder editar acá más adelante."
      />
      <ChangePasswordSection />
      <SessionsSection />
    </div>
  );
}

function ChangePasswordSection() {
  const session = useSession();
  const changePassword = useChangePassword();
  const [succeeded, setSucceeded] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword }) => {
    setSucceeded(false);
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          form.reset();
          setSucceeded(true);
        },
        onError: (error) => {
          // Errores por campo de la API (ej. contraseña actual incorrecta) van al campo; el foco,
          // al primero de ellos.
          const byField = fieldErrors(error);
          let focused = false;
          for (const field of FIELDS) {
            const message = byField[field];
            if (!message) continue;
            form.setError(field, { message }, { shouldFocus: !focused });
            focused = true;
          }
        },
      },
    );
  });

  // Mensaje general solo si la API no marcó ninguno de los campos del formulario.
  const apiFieldErrors = fieldErrors(changePassword.error);
  const generalError =
    changePassword.isError && !FIELDS.some((field) => field in apiFieldErrors)
      ? changePassword.error instanceof ApiError && changePassword.error.status === 429
        ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
        : 'No se pudo cambiar la contraseña. Intentá de nuevo en unos segundos.'
      : null;

  return (
    <section
      aria-labelledby="cambiar-contrasena-titulo"
      className="max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h2
          id="cambiar-contrasena-titulo"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <KeyRound className="size-5 text-primary" aria-hidden="true" />
          Cambiar contraseña
        </h2>
        <p className="text-sm text-muted-foreground">
          Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
        </p>
      </div>

      <div aria-live="polite">
        {succeeded && (
          <p className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            Listo: tu contraseña se actualizó.
          </p>
        )}
      </div>
      {generalError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {generalError}
        </p>
      )}

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        // El "Listo" se quita apenas se vuelve a escribir en el formulario.
        onChange={() => setSucceeded(false)}
        className="space-y-4"
      >
        {/* Usuario oculto: así los gestores de contraseñas asocian la nueva a esta cuenta. */}
        {session.data && (
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={session.data.email}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
        )}
        <FormField
          id="current-password"
          label="Contraseña actual"
          error={errors.currentPassword?.message}
        >
          {(aria) => (
            <PasswordInput
              {...aria}
              {...form.register('currentPassword')}
              autoComplete="current-password"
            />
          )}
        </FormField>
        <FormField
          id="new-password"
          label="Contraseña nueva"
          hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres. Una frase larga es más fácil de recordar y más segura.`}
          error={errors.newPassword?.message}
        >
          {(aria) => (
            <PasswordInput
              {...aria}
              {...form.register('newPassword')}
              autoComplete="new-password"
            />
          )}
        </FormField>
        <FormField
          id="confirm-password"
          label="Repetí la contraseña nueva"
          error={errors.confirmPassword?.message}
        >
          {(aria) => (
            <PasswordInput
              {...aria}
              {...form.register('confirmPassword')}
              autoComplete="new-password"
            />
          )}
        </FormField>

        <Button type="submit" className="min-h-11" disabled={changePassword.isPending}>
          {changePassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </section>
  );
}

function SessionsSection() {
  const logoutAll = useLogoutAll();

  return (
    <section
      aria-labelledby="sesiones-titulo"
      className="max-w-xl space-y-4 rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h2 id="sesiones-titulo" className="flex items-center gap-2 text-lg font-semibold">
          <MonitorSmartphone className="size-5 text-primary" aria-hidden="true" />
          Sesiones
        </h2>
        <p className="text-sm text-muted-foreground">
          Si dejaste la sesión abierta en otra computadora o perdiste el celular, podés cerrarla en
          todos lados. Vas a tener que volver a ingresar también acá.
        </p>
      </div>

      {/* Al cerrar el diálogo se descarta el error del intento anterior. */}
      <Dialog onOpenChange={(open) => !open && logoutAll.reset()}>
        <DialogTrigger asChild>
          <Button variant="outline" className="min-h-11">
            <LogOut aria-hidden="true" />
            Cerrar sesión en todos los dispositivos
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión en todos los dispositivos?</DialogTitle>
            <DialogDescription>
              Se cierran todas las sesiones abiertas del panel, incluida esta. Después vas a tener
              que ingresar de nuevo con tu email y contraseña.
            </DialogDescription>
          </DialogHeader>
          {logoutAll.isError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              No se pudieron cerrar las sesiones. Intentá de nuevo en unos segundos.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="min-h-11">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={logoutAll.isPending}
              onClick={() => logoutAll.mutate()}
            >
              {logoutAll.isPending ? 'Cerrando…' : 'Cerrar todas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
