import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Página no encontrada</h1>
      <p className="text-muted-foreground">La dirección que buscás no existe o fue movida.</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </section>
  );
}
