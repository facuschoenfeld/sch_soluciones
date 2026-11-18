import type { AuthUser, ChangePasswordInput, DataResponse, LoginInput } from '@sch/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, apiGet, apiSend } from '@/lib/api-client';
import { SESSION_QUERY_KEY, clearPanelData } from '@/lib/query-client';

// Sesión del panel. El token vive solo en la cookie httpOnly: el front nunca lo ve ni lo
// guarda. Saber si hay sesión = preguntarle a la API (GET /api/auth/me).

// La API responde `{ data: null }` (200) sin sesión: así no se generan errores en la consola.
async function fetchSession(): Promise<AuthUser | null> {
  return (await apiGet<DataResponse<AuthUser | null>>('/auth/me')).data;
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    // Se revalida al volver a la pestaña: si la sesión se cerró en otro lado, redirige.
    refetchOnWindowFocus: true,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) =>
      (await apiSend<DataResponse<AuthUser>>('POST', '/auth/login', input)).data,
    // Acá un 401 significa credenciales incorrectas, no sesión vencida.
    meta: { expectsUnauthorized: true },
    onSuccess: (user) => queryClient.setQueryData(SESSION_QUERY_KEY, user),
  });
}

export function useLogout() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => apiSend('POST', '/auth/logout'),
    // Aunque falle la red, del lado del front la sesión se da por cerrada. Se navega desde acá
    // (y no desde el componente, que se desmonta al cerrarse la sesión) y sin `?next=`: fue un
    // cierre a propósito.
    onSettled: (_data, error) => {
      // Si el servidor no confirmó el cierre, la cookie podría seguir activa: el login lo avisa.
      const logoutFailed = Boolean(error) && !(error instanceof ApiError && error.status === 401);
      const state: LogoutNavigationState = { loggedOut: true, logoutFailed };
      // Solo se navega: la sesión la limpia el login al montarse (useClearSessionAfterLogout).
      // Si se limpiara acá, RequireAuth redirigiría antes por su cuenta, con ?next= y sin aviso.
      void navigate('/admin/login', { replace: true, state });
    },
  });
}

/**
 * "Cerrar sesión en todos los dispositivos": la API invalida todas las sesiones (incluida esta)
 * y los dispositivos de confianza. Al terminar se va al login como en el logout normal.
 */
export function useLogoutAll() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => apiSend('POST', '/admin/logout-all'),
    onSuccess: () => {
      const state: LogoutNavigationState = { loggedOut: true, logoutFailed: false };
      void navigate('/admin/login', { replace: true, state });
    },
  });
}

/** Lo usa el login al llegar desde "Cerrar sesión": descarta la sesión y los datos del panel. */
export function useClearSessionAfterLogout(loggedOut: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (loggedOut) clearPanelData(queryClient);
  }, [loggedOut, queryClient]);
}

/** `location.state` con el que el logout llega al login. */
export interface LogoutNavigationState {
  loggedOut: true;
  logoutFailed: boolean;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => apiSend('POST', '/admin/password', input),
  });
}

/**
 * Destino después del login (`?next=`). Solo rutas internas del panel: evita redirigir a otro
 * sitio con un link armado (open redirect).
 */
export function safeAdminRedirect(next: string | null): string {
  if (
    next &&
    /^\/admin(?:[/?#]|$)/.test(next) &&
    !next.startsWith('//') &&
    !next.includes('\\') &&
    !next.startsWith('/admin/login')
  ) {
    return next;
  }
  return '/admin';
}
