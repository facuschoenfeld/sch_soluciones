import {
  applyPriceAdjustment,
  bulkPriceSchema,
  formatAmount,
  isValidAdjustedPrice,
  type AdminServiceSummary,
  type PriceAdjustment,
} from '@sch/shared';
import { useIsMutating } from '@tanstack/react-query';
import { ArrowRight, TriangleExclamationPoint } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { BULK_PRICE_MUTATION_KEY, mutationErrorMessage, useBulkPrice } from '@/lib/admin-api';
import { parseAmountInput } from '@/lib/amount-input';
import { cn } from '@/lib/utils';
import { FormField } from './form-field';

interface BulkPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: AdminServiceSummary[];
  onDone: () => void;
}

export function BulkPriceDialog({ open, onOpenChange, services, onDone }: BulkPriceDialogProps) {
  // Mientras se aplica no se puede cerrar: así el resultado (toast y selección) no se pierde.
  const applying = useIsMutating({ mutationKey: BULK_PRICE_MUTATION_KEY }) > 0;
  const count = services.length === 1 ? '1 servicio' : `${services.length} servicios`;

  return (
    <Dialog open={open} onOpenChange={(next) => (next || !applying) && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Actualizar precios ({count})</DialogTitle>
          <DialogDescription>
            Revisá cómo quedan antes de confirmar. Los precios nuevos se redondean al entero.
          </DialogDescription>
        </DialogHeader>
        {/* Se monta en cada apertura: arranca vacío. */}
        <BulkPriceForm
          services={services}
          onCancel={() => onOpenChange(false)}
          onDone={() => {
            onOpenChange(false);
            onDone();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface PreviewRow {
  service: AdminServiceSummary;
  before: number;
  after: number;
  valid: boolean;
}

function BulkPriceForm({
  services,
  onCancel,
  onDone,
}: {
  services: AdminServiceSummary[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const bulk = useBulkPrice();
  const kindName = useId();
  const [kind, setKind] = useState<PriceAdjustment['kind']>('PERCENT');
  const [rawValue, setRawValue] = useState('');

  const priced = services.filter(
    (service) => service.priceType !== 'QUOTE' && service.priceAmount !== null,
  );
  const skipped = services.filter((service) => !priced.includes(service));
  const currencies = new Set(priced.map((service) => service.currency));
  const mixedCurrencies = kind === 'AMOUNT' && currencies.size > 1;
  const symbol = currencies.size === 1 && currencies.has('USD') ? 'US$' : '$';

  const value = parseAmountInput(rawValue);
  const adjustment = value === null ? null : { kind, value };
  // Misma validación que la API (rango, decimales, distinto de 0).
  const validation = adjustment
    ? bulkPriceSchema.safeParse({ serviceIds: services.map((s) => s.id), adjustment })
    : null;
  const valueError =
    validation && !validation.success
      ? (validation.error.issues.find((issue) => issue.path[0] === 'adjustment')?.message ?? null)
      : null;
  const ready = Boolean(adjustment && validation?.success && !mixedCurrencies);

  const preview: PreviewRow[] = priced.map((service) => {
    const before = service.priceAmount ?? 0;
    const after = ready && adjustment ? applyPriceAdjustment(before, adjustment) : before;
    return { service, before, after, valid: isValidAdjustedPrice(after) };
  });
  const invalidCount = preview.filter((row) => !row.valid).length;
  const canSubmit = ready && invalidCount === 0 && priced.length > 0 && !bulk.isPending;

  const submit = () => {
    if (!adjustment || !canSubmit) return;
    bulk.mutate(
      { serviceIds: services.map((service) => service.id), adjustment },
      {
        onSuccess: ({ updated }) => {
          toast.success(
            updated.length === 1
              ? 'Se actualizó 1 precio'
              : `Se actualizaron ${updated.length} precios`,
          );
          onDone();
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de ajuste</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['PERCENT', 'Porcentaje (%)'],
              ['AMOUNT', `Monto fijo (${symbol})`],
            ] as const
          ).map(([option, label]) => (
            <label
              key={option}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                kind === option && 'border-primary bg-accent text-accent-foreground',
              )}
            >
              <input
                type="radio"
                name={kindName}
                value={option}
                checked={kind === option}
                onChange={() => {
                  setKind(option);
                  bulk.reset();
                }}
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        id="bulk-value"
        label={kind === 'PERCENT' ? 'Porcentaje' : 'Monto'}
        hint={
          kind === 'PERCENT'
            ? 'Ej.: 10 sube un 10 %; -5 baja un 5 %. Se aceptan decimales (7,5).'
            : `Ej.: 2000 suma ${symbol} 2.000 a cada precio; -500 resta ${symbol} 500.`
        }
        error={valueError ?? undefined}
      >
        {(aria) => (
          <Input
            {...aria}
            value={rawValue}
            onChange={(event) => {
              setRawValue(event.target.value);
              bulk.reset();
            }}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            className="h-11 max-w-48 tabular-nums"
          />
        )}
      </FormField>

      {mixedCurrencies && (
        <Notice>
          Hay servicios en pesos y en dólares: para sumar o restar un monto fijo, elegí servicios de
          una sola moneda (o usá un porcentaje).
        </Notice>
      )}
      {invalidCount > 0 && (
        <Notice>
          {invalidCount === 1
            ? 'Un precio quedaría negativo o demasiado grande'
            : `${invalidCount} precios quedarían negativos o demasiado grandes`}
          . Cambiá el ajuste.
        </Notice>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          Vista previa ({priced.length} {priced.length === 1 ? 'servicio' : 'servicios'})
        </h3>
        {priced.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Los servicios elegidos son &quot;a consultar&quot;: no tienen precio para actualizar.
          </p>
        ) : (
          // Con scroll horizontal en pantallas chicas: enfocable para recorrerla con el teclado.
          <div
            className="overflow-x-auto rounded-md border focus-ring"
            role="region"
            aria-label="Vista previa de precios"
            tabIndex={0}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Servicio
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Antes
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">Pasa a</span>
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Después
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.map(({ service, before, after, valid }) => (
                  <tr key={service.id} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {service.name}
                    </th>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {formatAmount(before, service.currency)}
                    </td>
                    <td className="px-1 py-2 text-muted-foreground">
                      <ArrowRight className="ml-auto size-4" aria-hidden="true" />
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums',
                        !valid && 'text-destructive',
                      )}
                    >
                      {ready ? formatAmount(after, service.currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {skipped.length > 0 && (
          <p className="text-sm text-muted-foreground">
            No cambian (son &quot;a consultar&quot;): {skipped.map((s) => s.name).join(', ')}.
          </p>
        )}
      </div>

      {bulk.isError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive-text"
        >
          {mutationErrorMessage(bulk.error, 'No se pudieron actualizar los precios')}
        </p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={bulk.isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="button" className="min-h-11" disabled={!canSubmit} onClick={submit}>
          {bulk.isPending
            ? 'Aplicando…'
            : `Aplicar a ${priced.length} ${priced.length === 1 ? 'servicio' : 'servicios'}`}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Aviso que cambia mientras se escribe: `status` para no interrumpir en cada tecla. */
function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive-text"
    >
      <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
