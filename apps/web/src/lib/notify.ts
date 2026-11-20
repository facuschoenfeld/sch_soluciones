import { toast } from 'sonner';

/** Duración de los toasts con acción ("Deshacer") o de error: hay que llegar a leerlos. */
export const LONG_TOAST_MS = 10_000;

export function notifyError(message: string): void {
  toast.error(message, { duration: LONG_TOAST_MS });
}
