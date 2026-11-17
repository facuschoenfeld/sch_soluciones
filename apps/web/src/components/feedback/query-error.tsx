import { RotateCw, TriangleExclamationPoint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface QueryErrorProps {
  /** Error de la consulta: define el mensaje (problema del servidor o de conexión). */
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

function messageFor(error: unknown): string {
  // Si la API respondió (cualquier status), no es un problema de conexión del visitante.
  if (error instanceof ApiError) {
    return 'El servidor tuvo un problema. Intentá de nuevo en unos segundos.';
  }
  return 'Revisá tu conexión e intentá de nuevo en unos segundos.';
}

/** Estado de error con opción de reintentar. */
export function QueryError({
  error,
  title = 'No se pudo cargar la información',
  onRetry,
  className,
}: QueryErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <TriangleExclamationPoint className="size-8 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{messageFor(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" className="min-h-11" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
