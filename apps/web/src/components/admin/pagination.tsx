import type { PaginationMeta } from '@sch/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Para el texto: "clientes", "trabajos". */
  itemsLabel: string;
  /** La página siguiente se está cargando (se sigue viendo la actual). */
  pending?: boolean;
}

/** Anterior / siguiente con el rango visible. Nada si entra todo en una página. */
export function Pagination({ meta, onPageChange, itemsLabel, pending = false }: PaginationProps) {
  const { page, pageSize, total } = meta;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && page === 1) return null;

  const first = Math.min(total, (page - 1) * pageSize + 1);
  const last = Math.min(total, page * pageSize);
  const go = (target: number) => {
    if (pending || target < 1 || target > pages) return;
    onPageChange(target);
  };

  return (
    <nav
      aria-label={`Páginas de ${itemsLabel}`}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {/* Sin aria-live: el resultado lo anuncia la región de estado del listado. */}
      <p className="text-sm text-muted-foreground">
        {first} a {last} de {total} {itemsLabel} · Página {page} de {pages}
      </p>
      <div className="flex gap-2">
        {/* aria-disabled (no disabled): el foco no se pierde al llegar a la primera o última. */}
        <Button
          variant="outline"
          className="min-h-11"
          aria-disabled={page <= 1 || pending}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          aria-disabled={page >= pages || pending}
          onClick={() => go(page + 1)}
        >
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
