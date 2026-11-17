import { useEffect, useState } from 'react';
import { useBusinessName } from '@/lib/public-api';

/** Devuelve el valor recién cuando dejó de cambiar durante `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * true cuando `active` lleva al menos `delayMs` en true. Se usa para avisar que una carga
 * tarda (arranque en frío del hosting gratuito) sin mostrar el aviso en cargas rápidas.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);

  return active && elapsed;
}

/** Título de la pestaña: "<página> · <negocio>" (el nombre sale de Settings). */
export function usePageTitle(title: string | null): void {
  const businessName = useBusinessName();

  useEffect(() => {
    document.title = title ? `${title} · ${businessName}` : businessName;
  }, [title, businessName]);
}
