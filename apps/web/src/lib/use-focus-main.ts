import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Al navegar a otra página, el foco pasa al contenido principal para que un lector de pantalla
 * anuncie el cambio (en una SPA no hay recarga). No aplica a la carga inicial ni a cambios de
 * filtros (?linea=…), que no cambian la ruta.
 */
export function useFocusMainOnNavigation() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return mainRef;
}

/**
 * Para `onCloseAutoFocus` de los menús laterales (Sheet): si al navegar el foco ya pasó al
 * <main>, se evita que Radix lo devuelva al botón que abrió el menú.
 */
export function keepFocusInMain(event: Event): void {
  if (document.getElementById('main')?.contains(document.activeElement)) {
    event.preventDefault();
  }
}
