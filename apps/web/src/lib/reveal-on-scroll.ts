import { useEffect } from 'react';

/**
 * Aparición al scrollear: los elementos con `.reveal` se ocultan (solo si este módulo corrió y el
 * visitante no pide "reducir movimiento", ver index.css) y se muestran con una transición al entrar
 * en pantalla, una sola vez. Los que entran juntos (una fila de tarjetas) se escalonan.
 *
 * El estado va en la clase `is-revealed`: los `.reveal` deben tener `className` fijo (si React lo
 * reescribiera, borraría la clase y el elemento quedaría oculto).
 */

/** Demora entre elementos que entran en el mismo momento, y tope de pasos. */
const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 4;

/** Clase en <html> que activa el estado oculto. Se pone antes del primer render (main.tsx). */
export const REVEAL_READY_CLASS = 'reveal-ready';
const REVEALED_CLASS = 'is-revealed';

export function enableRevealOnScroll() {
  if (typeof IntersectionObserver === 'undefined') return;
  document.documentElement.classList.add(REVEAL_READY_CLASS);
}

/** Observa los `.reveal` de la página (también los que aparecen después, al cargar datos). */
export function useRevealOnScroll() {
  useEffect(() => {
    if (!document.documentElement.classList.contains(REVEAL_READY_CLASS)) return;

    const io = new IntersectionObserver(
      (entries) => {
        let step = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.setProperty(
            '--reveal-delay',
            `${Math.min(step, MAX_STAGGER_STEPS) * STAGGER_MS}ms`,
          );
          el.classList.add(REVEALED_CLASS);
          io.unobserve(el);
          step++;
        }
      },
      // Se dispara apenas el elemento asoma por encima del 8 % inferior de la pantalla (umbral 0:
      // funciona igual con elementos más altos que la pantalla).
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
    );

    const observe = (el: Element) => {
      if (!el.classList.contains(REVEALED_CLASS)) io.observe(el);
    };
    document.querySelectorAll('.reveal').forEach(observe);

    const unobserve = (el: Element) => io.unobserve(el);
    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Lo que se desmonta sin haberse revelado (por ejemplo, al filtrar) deja de observarse.
        for (const node of mutation.removedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('.reveal')) unobserve(node);
          node.querySelectorAll('.reveal').forEach(unobserve);
        }
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('.reveal')) observe(node);
          node.querySelectorAll('.reveal').forEach(observe);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}
