import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Avisa antes de salir de un formulario con cambios sin guardar: al navegar dentro del panel
 * (diálogo propio) y al cerrar o recargar la pestaña (aviso del navegador).
 * `allowNavigation()` se llama justo antes de navegar después de guardar bien.
 */
export function useUnsavedChangesGuard(isDirty: boolean): {
  allowNavigation: () => void;
  dialog: ReactNode;
} {
  const allowed = useRef(false);
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !allowed.current &&
      currentLocation.pathname !== nextLocation.pathname &&
      // Cerrar sesión ya invalidó la cookie en el servidor: quedarse dejaría una sesión muerta.
      !(nextLocation.state as { loggedOut?: boolean } | null)?.loggedOut,
    [isDirty],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const allowNavigation = useCallback(() => {
    allowed.current = true;
  }, []);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
      title="¿Salir sin guardar?"
      description={<p>Hiciste cambios que todavía no guardaste. Si salís, se pierden.</p>}
      confirmLabel="Salir sin guardar"
      onConfirm={() => blocker.proceed?.()}
    />
  );

  return { allowNavigation, dialog };
}
