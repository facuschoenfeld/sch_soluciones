import { useEffect, useState } from 'react';
import { Toaster as Sonner, toast } from 'sonner';
import { focusMainIfLost } from '@/lib/focus';
import { getCurrentTheme, type Theme } from '@/lib/theme';

/**
 * Toasts del panel (sonner los anuncia con aria-live). Sigue el tema del sitio: observa la
 * clase `dark` del <html>, que cambia el botón de tema. Van abajo a la derecha, sin botón de
 * cerrar (se van solos; se pausan con el puntero encima o al expandirlos con Alt+T, y se pueden
 * deslizar). Ojo: el foco de teclado no los pausa. Con el foco dentro de un toast (Tab o
 * Alt+T), Escape los cierra a todos (`dismissToastsOnEscape`); al irse el último, sonner
 * devuelve el foco adonde estaba. El margen de abajo sale de una variable CSS (index.css):
 * suben sobre las barras fijas de abajo.
 */
export function Toaster() {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getCurrentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', dismissToastsOnEscape);
    return () => document.removeEventListener('keydown', dismissToastsOnEscape);
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      offset={{ bottom: 'var(--toast-offset-bottom)', right: '1rem' }}
      mobileOffset={{ bottom: 'var(--toast-offset-bottom)', left: '1rem', right: '1rem' }}
      duration={6000}
      richColors
      // Texto para lectores de pantalla (por defecto viene en inglés).
      containerAriaLabel="Notificaciones"
    />
  );
}

/** Sonner saca los toasts del DOM 200 ms después de cerrarlos; se deja un margen. */
const TOAST_REMOVAL_MS = 300;

/**
 * Sin botón de cerrar, es la forma de descartar los toasts con teclado. Solo actúa con el foco
 * dentro de ellos: Escape en un diálogo o en un campo no los toca, y uno que ya consumió otra
 * capa (Radix llama a preventDefault) se ignora. Sonner devuelve el foco al elemento previo;
 * si ese elemento ya no existe y el foco quedó en <body>, va a #main.
 */
function dismissToastsOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!(event.target instanceof Element) || !event.target.closest('[data-sonner-toaster]')) return;
  event.preventDefault();
  toast.dismiss();
  window.setTimeout(focusMainIfLost, TOAST_REMOVAL_MS);
}
