import { describe, expect, it } from 'vitest';
import { formatAmountInput, parseAmountInput } from './amount-input';

describe('parseAmountInput', () => {
  it.each([
    ['25.000', 25000],
    ['25000', 25000],
    ['1.500,50', 1500.5],
    ['1500,5', 1500.5],
    ['1500.5', 1500.5],
    ['$ 2.000', 2000],
    ['-1.000', -1000],
    ['-500', -500],
    ['1.234.567', 1234567],
    ['US$ 15', 15],
  ])('interpreta "%s" como %d', (raw, expected) => {
    expect(parseAmountInput(raw)).toBe(expected);
  });

  it('devuelve null para vacío o solo espacios', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('   ')).toBeNull();
    expect(parseAmountInput('$')).toBeNull();
  });

  it('devuelve NaN para texto que no es un número', () => {
    expect(parseAmountInput('abc')).toBeNaN();
    expect(parseAmountInput('12abc')).toBeNaN();
    expect(parseAmountInput('1,2,3')).toBeNaN();
    expect(parseAmountInput('--5')).toBeNaN();
  });

  it('deja pasar números y trata otros tipos como vacío', () => {
    expect(parseAmountInput(1500.5)).toBe(1500.5);
    expect(parseAmountInput(undefined)).toBeNull();
    expect(parseAmountInput(null)).toBeNull();
  });
});

describe('formatAmountInput', () => {
  it('formatea para precargar un input', () => {
    expect(formatAmountInput(25000)).toBe('25000');
    expect(formatAmountInput(1500.5)).toBe('1500,5');
    expect(formatAmountInput(0)).toBe('0');
  });

  it('devuelve vacío para null', () => {
    expect(formatAmountInput(null)).toBe('');
  });

  it('es inversa de parseAmountInput', () => {
    expect(parseAmountInput(formatAmountInput(1500.5))).toBe(1500.5);
  });
});
