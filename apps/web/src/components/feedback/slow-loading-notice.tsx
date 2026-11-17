import { useIsFetching } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useDelayedFlag } from '@/lib/hooks';

const SLOW_LOADING_DELAY_MS = 3000;

/**
 * Aviso global cuando una carga inicial tarda más de ~3 s. En el hosting gratuito el servidor y
 * la base se duermen sin tráfico y la primera visita puede tardar hasta un minuto. Solo cuenta
 * consultas sin datos todavía: un refetch en segundo plano no muestra el aviso.
 */
export function SlowLoadingNotice() {
  const isLoading = useIsFetching({ predicate: (query) => query.state.data === undefined }) > 0;
  const isSlow = useDelayedFlag(isLoading, SLOW_LOADING_DELAY_MS);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4"
    >
      {isSlow && (
        <p className="flex max-w-md items-start gap-3 rounded-2xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
          <LoaderCircle
            className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>
            <span className="block font-medium">Estamos cargando, un momento…</span>
            <span className="block text-muted-foreground">
              Si el sitio estuvo un rato sin visitas, puede tardar hasta un minuto.
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
