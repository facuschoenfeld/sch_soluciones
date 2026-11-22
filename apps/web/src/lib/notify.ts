import { toast } from 'sonner';

/** Duración de los toasts de error: hay que llegar a leerlos. */
export const LONG_TOAST_MS = 10_000;

/**
 * Duración de los toasts con "Deshacer" (decisión del usuario): el foco de teclado no los
 * pausa y están al final de la página, así que hay que dar tiempo a llegar con Tab o Alt+T.
 */
export const UNDO_TOAST_MS = 30_000;

export function notifyError(message: string): void {
  toast.error(message, { duration: LONG_TOAST_MS });
}
