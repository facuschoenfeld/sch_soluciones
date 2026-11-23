import { SEARCH_QUERY_MAX_LENGTH } from '@sch/shared';
import { Search, UserPlus } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminClients } from '@/lib/admin-api';
import { useDebouncedValue } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export interface ClientOption {
  id: number;
  fullName: string;
  phone?: string;
}

interface ClientPickerProps {
  /** Id del input de búsqueda; el label del campo debe tener id `<id>-label`. */
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  /** Para que el formulario enfoque el campo cuando tiene error. */
  inputRef?: Ref<{ focus: () => void }>;
  /** Link "Crear cliente" debajo de los resultados (en el alta de trabajos). */
  allowCreate?: boolean;
  /** Mostrar clientes antes de escribir (en el formulario sí; en los filtros, no ocupa lugar). */
  showInitialResults?: boolean;
  /** Texto del botón para quitar la selección ("Cambiar" en el formulario, "Quitar" en filtros). */
  clearLabel?: string;
}

const RESULTS_LIMIT = 6;

/**
 * Buscador de clientes: se escribe nombre, teléfono o email y se elige de la lista. Botones
 * comunes (no un combobox ARIA): se recorren con Tab y funcionan igual con lector de pantalla.
 */
export function ClientPicker({
  id,
  value,
  onChange,
  inputRef,
  allowCreate = false,
  showInitialResults = false,
  clearLabel = 'Cambiar',
  ...aria
}: ClientPickerProps) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 250);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  // A dónde mover el foco después de elegir o quitar (el control anterior desaparece).
  const focusTarget = useRef<'input' | 'clear' | null>(null);

  // Con un cliente elegido no hay input: el foco del formulario va al botón para cambiarlo.
  useImperativeHandle(inputRef, () => ({
    focus: () => (searchRef.current ?? clearRef.current)?.focus(),
  }));

  useEffect(() => {
    if (focusTarget.current === 'clear') clearRef.current?.focus();
    if (focusTarget.current === 'input') searchRef.current?.focus();
    focusTarget.current = null;
  }, [value?.id]);

  if (value) {
    return (
      <div
        role="group"
        aria-labelledby={`${id}-label ${id}-selected`}
        aria-describedby={aria['aria-describedby']}
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
      >
        <p id={`${id}-selected`} className="min-w-0">
          <span className="block font-medium break-words">{value.fullName}</span>
          {value.phone && (
            <span className="text-sm text-muted-foreground tabular-nums">{value.phone}</span>
          )}
        </p>
        <Button
          ref={clearRef}
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            focusTarget.current = 'input';
            setText('');
            onChange(null);
          }}
        >
          {clearLabel}
          <span className="sr-only"> el cliente</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          {...aria}
          id={id}
          ref={searchRef}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          placeholder="Nombre, teléfono o email"
          autoComplete="off"
          className="h-11 pl-9"
        />
      </div>
      {(q || showInitialResults) && (
        <ClientResults
          q={q}
          onSelect={(client) => {
            focusTarget.current = 'clear';
            onChange(client);
          }}
        />
      )}
      {allowCreate && (
        <Button asChild variant="link" className="min-h-11 px-0">
          <Link to="/admin/clientes/nuevo?volver=trabajo">
            <UserPlus aria-hidden="true" />
            ¿No está? Crear cliente
          </Link>
        </Button>
      )}
    </div>
  );
}

function ClientResults({ q, onSelect }: { q: string; onSelect: (client: ClientOption) => void }) {
  const params = new URLSearchParams({ pageSize: String(RESULTS_LIMIT) });
  if (q) params.set('q', q);
  const clients = useAdminClients(params.toString());

  if (clients.isPending) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Buscando…
      </p>
    );
  }
  if (clients.isError) {
    return (
      <p className="text-sm font-medium text-destructive-text" role="alert">
        No se pudo buscar. Revisá la conexión e intentá de nuevo.
      </p>
    );
  }

  const { data, meta } = clients.data;
  // Mientras llega la búsqueda nueva se ven los resultados anteriores, atenuados.
  const stale = clients.isPlaceholderData;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground" role="status">
        {stale
          ? 'Buscando…'
          : data.length === 0
            ? q
              ? 'Ningún cliente coincide con la búsqueda.'
              : 'Todavía no hay clientes.'
            : meta.total > data.length
              ? `${meta.total} clientes: se muestran los primeros ${data.length}. Escribí para afinar.`
              : meta.total === 1
                ? '1 cliente'
                : `${meta.total} clientes`}
      </p>
      {data.length > 0 && (
        <ul
          className={cn('divide-y rounded-md border', stale && 'opacity-60')}
          aria-label="Clientes encontrados"
          aria-busy={stale}
        >
          {data.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-left focus-ring hover:bg-accent"
                onClick={() =>
                  onSelect({ id: client.id, fullName: client.fullName, phone: client.phone })
                }
              >
                <span className="font-medium break-words">{client.fullName}</span>
                <span className="text-sm break-all text-muted-foreground">
                  <span className="tabular-nums">{client.phone}</span>
                  {client.email && ` · ${client.email}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
