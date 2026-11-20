import { formatPrice, priceAmountSchema, type AdminServiceSummary } from '@sch/shared';
import { Check, Pencil, X } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mutationErrorMessage, useUpdateService } from '@/lib/admin-api';
import { formatAmountInput, parseAmountInput } from '@/lib/amount-input';

/**
 * Precio de un servicio en la tabla, con edición rápida del monto (Enter guarda, Escape
 * cancela). Los "a consultar" no tienen monto: se cambian desde el formulario.
 */
export function InlinePriceEditor({ service }: { service: AdminServiceSummary }) {
  const update = useUpdateService();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const label = formatPrice(service);
  const inputId = `price-${service.id}`;
  const errorId = `${inputId}-error`;

  if (service.priceType === 'QUOTE') {
    return (
      <span
        className="text-sm text-muted-foreground"
        title="Se cambia desde el formulario del servicio"
      >
        {label}
      </span>
    );
  }

  const startEditing = () => {
    setValue(formatAmountInput(service.priceAmount));
    setError(null);
    setEditing(true);
  };

  const stopEditing = () => {
    // Mientras guarda no se cierra: si fallara, el error no se vería.
    if (update.isPending) return;
    setEditing(false);
    // El foco vuelve al botón que abrió la edición.
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    const parsed = priceAmountSchema.safeParse(parseAmountInput(value) ?? Number.NaN);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Monto inválido');
      return;
    }
    if (parsed.data === service.priceAmount) {
      stopEditing();
      return;
    }
    update.mutate(
      { id: service.id, patch: { priceAmount: parsed.data } },
      {
        onSuccess: (saved) => {
          toast.success(`Precio de "${saved.name}": ${formatPrice(saved)}`);
          stopEditing();
        },
        onError: (mutationError) =>
          setError(mutationErrorMessage(mutationError, 'No se pudo guardar el precio')),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stopEditing();
    }
  };

  if (!editing) {
    return (
      <Button
        ref={editButtonRef}
        type="button"
        variant="ghost"
        className="-ml-3 min-h-11 justify-start px-3 font-medium tabular-nums"
        onClick={startEditing}
        aria-label={`Editar precio de ${service.name} (${label})`}
        title="Editar precio"
      >
        {label}
        <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <form onSubmit={save} onKeyDown={onKeyDown} className="space-y-1" noValidate>
      <div className="flex items-center gap-1">
        <label htmlFor={inputId} className="sr-only">
          Precio de {service.name} en {service.currency}
        </label>
        <span className="text-sm text-muted-foreground" aria-hidden="true">
          {service.currency === 'USD' ? 'US$' : '$'}
        </span>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          className="h-11 w-32 tabular-nums"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <Button
          type="submit"
          size="icon"
          className="size-11"
          aria-disabled={update.isPending}
          aria-label="Guardar precio"
          title="Guardar (Enter)"
        >
          <Check aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          onClick={stopEditing}
          aria-label="Cancelar"
          title="Cancelar (Escape)"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
