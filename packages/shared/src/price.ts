import type { Currency, PriceType } from './enums.js';

export interface PriceInput {
  priceType: PriceType;
  /** Monto en unidades de la moneda (ej. 25000). Null cuando priceType = QUOTE. */
  priceAmount: number | null;
  currency: Currency;
  /** Texto opcional, ej. "por equipo", "por hora". */
  priceUnit?: string | null;
}

export const QUOTE_LABEL = 'A consultar';

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: Currency, fractionDigits: 0 | 2): Intl.NumberFormat {
  const key = `${currency}-${fractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Formatea solo el monto en es-AR: "$ 25.000", "$ 1.500,50", "US$ 100".
 * Los montos enteros se muestran sin decimales. El espacio tras el símbolo es
 * no separable (U+00A0), como lo devuelve Intl, para que no se corte en dos líneas.
 */
export function formatAmount(amount: number, currency: Currency): string {
  // Se decide sobre el monto ya redondeado a centavos: 10.996 → "$ 11" (no "$ 11,00").
  const isWhole = Math.round(amount * 100) % 100 === 0;
  return getFormatter(currency, isWhole ? 0 : 2).format(amount);
}

/**
 * Texto de precio para mostrar al público según el tipo:
 * - FIXED → "$ 25.000"
 * - FROM  → "Desde $ 25.000"
 * - QUOTE → "A consultar"
 * Si hay unidad se agrega al final ("$ 25.000 por equipo"); nunca en QUOTE.
 * Si un FIXED/FROM no tiene monto válido (no debería pasar: lo impide la base), cae en "A consultar".
 */
export function formatPrice({ priceType, priceAmount, currency, priceUnit }: PriceInput): string {
  if (priceType === 'QUOTE' || priceAmount === null || !Number.isFinite(priceAmount)) {
    return QUOTE_LABEL;
  }

  const amount = formatAmount(priceAmount, currency);
  const base = priceType === 'FROM' ? `Desde ${amount}` : amount;
  const unit = priceUnit?.trim();
  return unit ? `${base} ${unit}` : base;
}
