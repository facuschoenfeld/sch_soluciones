import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';
import { getCurrentTheme, type Theme } from '@/lib/theme';

/**
 * Toasts del panel (sonner los anuncia con aria-live). Sigue el tema del sitio: observa la
 * clase `dark` del <html>, que cambia el botón de tema. Van abajo a la derecha, sin botón de
 * cerrar (se van solos; se pausan con el puntero encima o al expandirlos con Alt+T, y se pueden
 * deslizar). Ojo: el foco de teclado no los pausa. El margen de abajo sale de una variable
 * CSS (index.css): suben sobre las barras fijas de abajo.
 */
export function Toaster() {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getCurrentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
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
