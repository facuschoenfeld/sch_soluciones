import { Wrench } from 'lucide-react';
import { Link } from 'react-router';

// Placeholder: la navegación completa se arma en la Fase 3.
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Wrench className="size-5" aria-hidden="true" />
          SCH Soluciones
        </Link>
      </div>
    </header>
  );
}
