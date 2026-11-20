import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  /** Error del último intento (se muestra dentro del diálogo). */
  error?: string | null;
  destructive?: boolean;
  onConfirm: () => void;
  /** Para mover el foco al cerrar si el disparador ya no existe (ej. se borró el ítem). */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Confirmación para acciones destructivas. El botón de confirmar no cierra el diálogo: lo
 * cierra quien lo usa al terminar bien, así un error se puede leer y reintentar.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel = 'Procesando…',
  pending = false,
  error,
  destructive = true,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive-text"
          >
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={pending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            className="min-h-11"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
