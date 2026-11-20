import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';
import { getCurrentTheme, type Theme } from '@/lib/theme';

/**
 * Toasts del panel (sonner los anuncia con aria-live). Sigue el tema del sitio: observa la
 * clase `dark` del <html>, que cambia el botón de tema. Van arriba, debajo de la barra
 * superior: abajo taparían las barras de selección y de guardado.
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
      position="top-center"
      offset={72}
      mobileOffset={{ top: 72 }}
      duration={6000}
      closeButton
      richColors
      // Textos para lectores de pantalla (por defecto vienen en inglés).
      toastOptions={{ closeButtonAriaLabel: 'Cerrar notificación' }}
      containerAriaLabel="Notificaciones"
    />
  );
}
