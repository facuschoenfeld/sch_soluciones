const CLEARANCE_VAR = '--toast-clearance';

/** Espacio que pide cada barra a la vista; se publica el mayor. */
const clearances = new Map<HTMLElement, number>();

function publish() {
  const root = document.documentElement.style;
  if (clearances.size === 0) {
    root.removeProperty(CLEARANCE_VAR);
    return;
  }
  root.setProperty(CLEARANCE_VAR, `${Math.max(...clearances.values())}px`);
}

/**
 * Ref para una barra fija abajo (selección, guardado): mientras está montada, los toasts
 * (abajo a la derecha) se apilan por encima en vez de taparla. Publica su alto más su
 * separación del borde en `--toast-clearance`, que usa `--toast-offset-bottom` (index.css).
 * Con varias barras a la vez vale la mayor. El `bottom` se relee solo cuando la barra cambia
 * de tamaño: no sirve para barras con un `bottom` que cambie según el ancho. Es estable a
 * nivel de módulo: React no la vuelve a llamar en cada render.
 */
export function avoidToasts(element: HTMLElement | null): (() => void) | undefined {
  if (!element) return undefined;
  // Marca para index.css: sus hijos no se desplazan por el scroll-padding que ella misma pide.
  element.dataset.avoidToasts = '';
  const update = () => {
    // Alto + separación del borde (bottom-4 en la barra fija, 0 en la sticky).
    const bottom = Number.parseFloat(getComputedStyle(element).bottom) || 0;
    clearances.set(element, element.offsetHeight + bottom);
    publish();
  };
  update();
  // La barra cambia de alto al pasar a dos líneas (celular, textos más largos) o al cambiar
  // su padding/borde según el ancho: se observa el border-box, que es lo que mide offsetHeight.
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  observer?.observe(element, { box: 'border-box' });
  return () => {
    observer?.disconnect();
    clearances.delete(element);
    publish();
  };
}
