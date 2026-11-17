import { describe, expect, it } from 'vitest';
import { QUOTE_LABEL, formatAmount, formatPrice } from './price.js';

// Intl separa el símbolo del monto con un espacio no separable (U+00A0).
const NBSP = String.fromCharCode(0xa0);

describe('formatAmount', () => {
  it.each([
    [25000, 'ARS', `$${NBSP}25.000`],
    [0, 'ARS', `$${NBSP}0`],
    [1500.5, 'ARS', `$${NBSP}1.500,50`],
    [1234567.89, 'ARS', `$${NBSP}1.234.567,89`],
    [100, 'USD', `US$${NBSP}100`],
    [99.9, 'USD', `US$${NBSP}99,90`],
  ] as const)('formatea %s %s como %j', (amount, currency, expected) => {
    expect(formatAmount(amount, currency)).toBe(expected);
  });
});

describe('formatPrice', () => {
  it('precio fijo en ARS', () => {
    expect(formatPrice({ priceType: 'FIXED', priceAmount: 25000, currency: 'ARS' })).toBe(
      `$${NBSP}25.000`,
    );
  });

  it('precio "desde"', () => {
    expect(formatPrice({ priceType: 'FROM', priceAmount: 150000, currency: 'ARS' })).toBe(
      `Desde $${NBSP}150.000`,
    );
  });

  it('precio "a consultar" ignora monto y unidad', () => {
    expect(
      formatPrice({ priceType: 'QUOTE', priceAmount: 500, currency: 'USD', priceUnit: 'por hora' }),
    ).toBe(QUOTE_LABEL);
  });

  it('agrega la unidad recortando espacios', () => {
    expect(
      formatPrice({
        priceType: 'FIXED',
        priceAmount: 18000,
        currency: 'ARS',
        priceUnit: '  por equipo ',
      }),
    ).toBe(`$${NBSP}18.000 por equipo`);
  });

  it('ignora una unidad vacía o null', () => {
    const base = { priceType: 'FIXED', priceAmount: 1000, currency: 'ARS' } as const;
    expect(formatPrice({ ...base, priceUnit: '   ' })).toBe(`$${NBSP}1.000`);
    expect(formatPrice({ ...base, priceUnit: null })).toBe(`$${NBSP}1.000`);
  });

  it('precio en USD con "desde"', () => {
    expect(formatPrice({ priceType: 'FROM', priceAmount: 300, currency: 'USD' })).toBe(
      `Desde US$${NBSP}300`,
    );
  });

  it('cae en "A consultar" si un FIXED/FROM no tiene monto válido', () => {
    expect(formatPrice({ priceType: 'FIXED', priceAmount: null, currency: 'ARS' })).toBe(
      QUOTE_LABEL,
    );
    expect(formatPrice({ priceType: 'FROM', priceAmount: Number.NaN, currency: 'ARS' })).toBe(
      QUOTE_LABEL,
    );
  });

  it('muestra precio 0 (no lo confunde con ausencia de monto)', () => {
    expect(formatPrice({ priceType: 'FIXED', priceAmount: 0, currency: 'ARS' })).toBe(`$${NBSP}0`);
  });
});
