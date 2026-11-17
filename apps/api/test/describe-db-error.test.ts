import { describe, expect, it } from 'vitest';
import { describeDbError } from '../src/lib/prisma.js';

describe('describeDbError', () => {
  it('devuelve el mensaje de un error de una sola línea', () => {
    expect(describeDbError(new Error('connect ECONNREFUSED'))).toBe('connect ECONNREFUSED');
  });

  it('se queda con la última línea no vacía de un mensaje multilínea', () => {
    const error = new Error(
      'Invalid `prisma.$queryRaw()` invocation:\n\n  SELECT 1\n\n  password authentication failed  \n',
    );
    expect(describeDbError(error)).toBe('password authentication failed');
  });

  it('usa el nombre del error si el mensaje está vacío', () => {
    expect(describeDbError(new TypeError(''))).toBe('TypeError');
  });

  it('convierte valores que no son Error a string', () => {
    expect(describeDbError('fallo')).toBe('fallo');
    expect(describeDbError(42)).toBe('42');
    expect(describeDbError(null)).toBe('null');
  });
});
