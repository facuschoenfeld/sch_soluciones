import { ArrowLeftIcon } from '@animateicons/react/lucide/arrow-left-icon';
import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { AnimatedIcon } from '@/components/icons/animated-icon';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/lib/hooks';

export function NotFoundPage() {
  usePageTitle('Página no encontrada');

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:py-24">
      <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold text-primary">Error 404</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Página no encontrada</h1>
      <p className="max-w-xl text-muted-foreground">
        La dirección que buscás no existe o fue movida.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="min-h-11">
          <Link to="/">
            <AnimatedIcon icon={ArrowLeftIcon} />
            Volver al inicio
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="min-h-11">
          <Link to="/servicios">Ver servicios</Link>
        </Button>
      </div>
    </section>
  );
}
