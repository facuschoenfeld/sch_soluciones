import { describe, expect, it } from 'vitest';
import { formatAmount, formatPrice } from './price.js';

// Intl separa el símbolo del monto con un espacio no separable (U+00A0).
const NBSP = String.fromCharCode(0xa0);

describe('formatAmount: bordes', () => {
  it.each([
    [1_000_000, 'ARS', `$${NBSP}1.000.000`],
    [999_999_999, 'ARS', `$${NBSP}999.999.999`],
    [1_000_000_000_000, 'ARS', `$${NBSP}1.000.000.000.000`],
    [9_999_999_999.99, 'ARS', `$${NBSP}9.999.999.999,99`],
    [1_234_567, 'USD', `US$${NBSP}1.234.567`],
  ] as const)('monto grande %s %s -> %j', (amount, currency, expected) => {
    expect(formatAmount(amount, currency)).toBe(expected);
  });

  it.each([
    [0.01, `$${NBSP}0,01`],
    [0.1, `$${NBSP}0,10`],
    [0.005, `$${NBSP}0,01`],
    [0.004, `$${NBSP}0`],
    [10.994, `$${NBSP}10,99`],
    [10.996, `$${NBSP}11`],
    [1.5, `$${NBSP}1,50`],
  ] as const)('redondea a 2 decimales %s -> %j', (amount, expected) => {
    expect(formatAmount(amount, 'ARS')).toBe(expected);
  });

  it('un monto entero expresado con .0 se muestra sin decimales', () => {
    expect(formatAmount(25000.0, 'ARS')).toBe(`$${NBSP}25.000`);
  });
});

describe('formatPrice: bordes', () => {
  it('FIXED con monto 0 se muestra como $ 0 (no cae en "A consultar")', () => {
    expect(formatPrice({ priceType: 'FIXED', priceAmount: 0, currency: 'ARS' })).toBe(`$${NBSP}0`);
  });

  it('FROM con monto grande y unidad', () => {
    expect(
      formatPrice({
        priceType: 'FROM',
        priceAmount: 1_500_000.5,
        currency: 'ARS',
        priceUnit: 'por proyecto',
      }),
    ).toBe(`Desde $${NBSP}1.500.000,50 por proyecto`);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'monto no finito %s cae en "A consultar"',
    (n) => {
      expect(formatPrice({ priceType: 'FIXED', priceAmount: n, currency: 'ARS' })).toBe(
        'A consultar',
      );
    },
  );

  it('una unidad solo con espacios se ignora', () => {
    expect(
      formatPrice({ priceType: 'FIXED', priceAmount: 100, currency: 'USD', priceUnit: '   ' }),
    ).toBe(`US$${NBSP}100`);
  });
});
