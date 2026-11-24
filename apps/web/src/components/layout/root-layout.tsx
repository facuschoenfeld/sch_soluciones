import { Outlet, ScrollRestoration } from 'react-router';
import { SlowLoadingNotice } from '@/components/feedback/slow-loading-notice';
import { WhatsappButton } from '@/components/whatsapp/whatsapp-button';
import { WhatsappIcon } from '@/components/whatsapp/whatsapp-icon';
import { useRevealOnScroll } from '@/lib/reveal-on-scroll';
import { useFocusMainOnNavigation } from '@/lib/use-focus-main';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function RootLayout() {
  const mainRef = useFocusMainOnNavigation();
  useRevealOnScroll();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <main ref={mainRef} id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />

      {/* Botón flotante de WhatsApp en todas las páginas (mensaje general, sin servicio). */}
      <WhatsappButton
        variant="whatsapp"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg"
        aria-label="Escribir por WhatsApp"
        title="Escribir por WhatsApp"
      >
        <WhatsappIcon className="size-7" aria-hidden="true" />
      </WhatsappButton>

      <SlowLoadingNotice />
      <ScrollRestoration />
    </div>
  );
}
