import { PRICE_MAX } from './constraints.js';

/** Ajuste de la actualización masiva de precios: porcentaje (+10 / -5,5) o monto fijo (+2000). */
export type PriceAdjustment =
  { kind: 'PERCENT'; value: number } | { kind: 'AMOUNT'; value: number };

export const PRICE_ADJUSTMENT_PERCENT_MIN = -99.99;
export const PRICE_ADJUSTMENT_PERCENT_MAX = 1000;

/** True si el número tiene a lo sumo 2 decimales (tolera el error de representación de 0,1 + 0,2). */
export function hasAtMostTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const scaled = value * 100;
  // Tolerancia relativa (unos pocos ULP): con montos de 1e9 o más, el error de `value * 100`
  // supera cualquier tolerancia fija chica, pero sigue muy lejos de un tercer decimal.
  const tolerance = Math.max(1e-9, Math.abs(scaled) * Number.EPSILON * 8);
  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

/** Divide redondeando la mitad hacia afuera de cero (1,5 → 2; -1,5 → -2). */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const half = denominator / 2n;
  return numerator >= 0n ? (numerator + half) / denominator : -((-numerator + half) / denominator);
}

function toCents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

/**
 * Aplica el ajuste y redondea el resultado al entero (decisión del negocio: los precios nuevos
 * quedan "al peso"). Se calcula con enteros (`bigint`) para no arrastrar errores de punto
 * flotante: el mismo cálculo corre en la vista previa del panel y en la API.
 * El resultado puede ser negativo o superar el máximo: lo valida quien lo usa
 * (`isValidAdjustedPrice`).
 */
export function applyPriceAdjustment(amount: number, adjustment: PriceAdjustment): number {
  const cents = toCents(amount);
  if (adjustment.kind === 'PERCENT') {
    // cents × (100 % + ajuste), con el porcentaje en centésimas: 10,5 % → 1050.
    const numerator = cents * (10_000n + toCents(adjustment.value));
    return Number(divideRounded(numerator, 10_000n * 100n));
  }
  return Number(divideRounded(cents + toCents(adjustment.value), 100n));
}

export function isValidAdjustedPrice(amount: number): boolean {
  return Number.isFinite(amount) && amount >= 0 && amount <= PRICE_MAX;
}
