import type { ExportFormat } from '@sch/shared';
import { Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { mutationErrorMessage } from '@/lib/admin-api';
import { ApiError, apiDownload } from '@/lib/api-client';
import { clearPanelData } from '@/lib/query-client';
import { notifyError } from '@/lib/notify';

interface ExportButtonsProps {
  /** Ej.: "/admin/clients/export". */
  path: string;
  /** Query string de los filtros para cada formato (sin "?"). */
  query: (format: ExportFormat) => string;
  /** Base del nombre si la API no lo manda (ej. "clientes"). */
  fileName: string;
  /** Texto accesible del grupo: "Exportar clientes". */
  label: string;
  /** Qué se exporta, para el nombre accesible de cada botón: "clientes". */
  itemsLabel: string;
}

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'pdf', label: 'PDF' },
  { format: 'csv', label: 'CSV (Excel)' },
];

/** Descarga el listado (con los filtros aplicados) en PDF o CSV. */
export function ExportButtons({ path, query, fileName, label, itemsLabel }: ExportButtonsProps) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const queryClient = useQueryClient();

  const download = async (format: ExportFormat) => {
    if (pending) return;
    setPending(format);
    try {
      const name = await apiDownload(`${path}?${query(format)}`, `${fileName}.${format}`);
      toast.success(`Se descargó ${name}`);
    } catch (error) {
      // Sesión vencida: igual que en el resto del panel, se cierra y se va al login.
      if (error instanceof ApiError && error.status === 401) {
        clearPanelData(queryClient);
        return;
      }
      notifyError(mutationErrorMessage(error, 'No se pudo generar el archivo'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        Exportar
      </span>
      {FORMATS.map(({ format, label: formatLabel }) => (
        <Button
          key={format}
          variant="outline"
          className="min-h-11"
          aria-disabled={pending !== null}
          aria-label={
            pending === format ? 'Generando…' : `Exportar ${itemsLabel} en ${formatLabel}`
          }
          onClick={() => void download(format)}
        >
          <Download aria-hidden="true" />
          {pending === format ? 'Generando…' : formatLabel}
        </Button>
      ))}
    </div>
  );
}
