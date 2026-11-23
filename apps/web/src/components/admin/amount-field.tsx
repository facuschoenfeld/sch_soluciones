import type { Currency } from '@sch/shared';
import { useState, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import { formatAmountInput, parseAmountInput } from '@/lib/amount-input';

interface AmountFieldProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  currency: Currency;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

const sameAmount = (a: number | null, b: number | null) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * Monto en formato argentino ("25.000", "1.500,50"). Guarda el texto tal cual se escribe (no
 * se reformatea mientras se tipea) y al formulario le pasa el número (NaN si no es válido).
 * Si el valor cambia desde afuera (ej. se precarga el precio de un servicio), se muestra.
 */
export function AmountField({
  currency,
  value,
  onChange,
  onBlur,
  inputRef,
  ...aria
}: AmountFieldProps) {
  const [text, setText] = useState(() => formatAmountInput(value));
  // Ajuste de estado durante el render (patrón de React): solo si el valor vino de afuera.
  if (!sameAmount(value, parseAmountInput(text))) setText(formatAmountInput(value));

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        {currency === 'USD' ? 'US$' : '$'}
      </span>
      <Input
        {...aria}
        ref={inputRef}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseAmountInput(event.target.value));
        }}
        onBlur={onBlur}
        inputMode="decimal"
        autoComplete="off"
        className="h-11 tabular-nums"
      />
    </div>
  );
}
