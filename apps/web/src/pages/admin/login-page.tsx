import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@sch/shared';
import { ArrowLeft, LockKeyhole, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { FormField, PasswordInput } from '@/components/admin/form-field';
import { PanelLoading } from '@/components/admin/require-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import {
  safeAdminRedirect,
  useClearSessionAfterLogout,
  useLogin,
  useSession,
  type LogoutNavigationState,
} from '@/lib/auth';
import { usePageTitle } from '@/lib/hooks';

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Email o contraseña incorrectos.';
    if (error.status === 429) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (error.status === 400) return 'Revisá los datos ingresados.';
    return 'El servidor tuvo un problema. Intentá de nuevo en unos segundos.';
  }
  return 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.';
}

export function LoginPage() {
  usePageTitle('Ingresar al panel');
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Viene de "Cerrar sesión": la sesión se limpia apenas termina de navegar, así que no hay que
  // redirigir al panel aunque todavía figure. logoutFailed = el servidor no confirmó el cierre.
  const logoutState = useLocation().state as Partial<LogoutNavigationState> | null;
  const logoutFailed = logoutState?.logoutFailed === true;
  useClearSessionAfterLogout(logoutState?.loggedOut === true);
  const next = safeAdminRedirect(searchParams.get('next'));

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  // Con sesión abierta no tiene sentido mostrar el login.
  if (session.data && !logoutState?.loggedOut) return <Navigate to={next} replace />;
  if (session.isPending) return <PanelLoading />;

  // Con un error general (credenciales, 429), los campos también lo referencian.
  const withLoginError = <T extends { 'aria-describedby': string | undefined }>(aria: T): T => ({
    ...aria,
    'aria-describedby':
      [aria['aria-describedby'], login.isError ? 'login-error' : undefined]
        .filter(Boolean)
        .join(' ') || undefined,
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => void navigate(next, { replace: true }),
      // La contraseña no queda escrita tras un intento fallido.
      onError: () => {
        form.resetField('password');
        form.setFocus('password');
      },
    });
  });

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu email y contraseña.</p>
        </div>

        <form
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
        >
          {logoutFailed && !login.isError && (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
              No se pudo confirmar el cierre de sesión con el servidor. Si estás en una computadora
              compartida, cerrá el navegador.
            </p>
          )}
          {login.isError && (
            <p
              id="login-error"
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {loginErrorMessage(login.error)}
            </p>
          )}

          <FormField id="login-email" label="Email" error={errors.email?.message}>
            {(aria) => (
              <Input
                {...withLoginError(aria)}
                {...form.register('email')}
                type="email"
                autoComplete="username"
                inputMode="email"
                className="h-11"
              />
            )}
          </FormField>

          <FormField id="login-password" label="Contraseña" error={errors.password?.message}>
            {(aria) => (
              <PasswordInput
                {...withLoginError(aria)}
                {...form.register('password')}
                autoComplete="current-password"
              />
            )}
          </FormField>

          <Button type="submit" className="min-h-11 w-full" disabled={login.isPending}>
            <LogIn aria-hidden="true" />
            {login.isPending ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>

        <p className="text-center">
          <Button asChild variant="link" className="min-h-11">
            <Link to="/">
              <ArrowLeft aria-hidden="true" />
              Volver al sitio
            </Link>
          </Button>
        </p>
      </div>
    </main>
  );
}
