import { describe, expect, it } from 'vitest';
import { publicServicesQuerySchema, slugSchema } from './schemas.js';
import { SLUG_PATTERN, isValidSlug } from './constraints.js';

describe('slugSchema', () => {
  it.each(['windows', 'instalacion-de-windows', 'pc-2024', '123', 'a'])(
    'acepta el slug válido %j',
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(true);
    },
  );

  it.each([
    ['vacío', ''],
    ['mayúsculas', 'Windows'],
    ['espacios', 'instalacion de windows'],
    ['guion al inicio', '-windows'],
    ['guion al final', 'windows-'],
    ['guiones dobles', 'a--b'],
    ['guion bajo', 'a_b'],
    ['tilde', 'instalación'],
    ['barra', 'a/b'],
    ['salto de línea final', 'windows\n'],
  ])('rechaza un slug inválido: %s', (_caso, slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });

  it('acepta exactamente 120 caracteres y rechaza 121', () => {
    expect(slugSchema.safeParse('a'.repeat(120)).success).toBe(true);
    expect(slugSchema.safeParse('a'.repeat(121)).success).toBe(false);
  });

  it('rechaza valores que no son string', () => {
    expect(slugSchema.safeParse(123).success).toBe(false);
    expect(slugSchema.safeParse(null).success).toBe(false);
    expect(slugSchema.safeParse(undefined).success).toBe(false);
  });

  it('expone el patrón usado', () => {
    expect(SLUG_PATTERN.test('ok-slug')).toBe(true);
  });

  it('isValidSlug (sin Zod, para el front) coincide con slugSchema', () => {
    for (const value of ['ok-slug', 'a'.repeat(120), 'a'.repeat(121), 'Mal Slug', '', '-a']) {
      expect(isValidSlug(value)).toBe(slugSchema.safeParse(value).success);
    }
  });
});

describe('publicServicesQuerySchema', () => {
  it('acepta una query vacía', () => {
    expect(publicServicesQuerySchema.parse({})).toEqual({});
  });

  it('acepta category y q válidos', () => {
    expect(publicServicesQuerySchema.parse({ category: 'reparacion', q: 'windows' })).toEqual({
      category: 'reparacion',
      q: 'windows',
    });
  });

  it('trata category vacía como ausente', () => {
    expect(publicServicesQuerySchema.parse({ category: '' }).category).toBeUndefined();
  });

  it.each(['', '   ', '\t\n'])('trata q %j como ausente', (q) => {
    expect(publicServicesQuerySchema.parse({ q }).q).toBeUndefined();
  });

  it('recorta los espacios de q', () => {
    expect(publicServicesQuerySchema.parse({ q: '  windows  ' }).q).toBe('windows');
  });

  it('acepta q de 100 caracteres y rechaza 101', () => {
    expect(publicServicesQuerySchema.safeParse({ q: 'a'.repeat(100) }).success).toBe(true);
    expect(publicServicesQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rechaza una category con formato inválido', () => {
    expect(publicServicesQuerySchema.safeParse({ category: 'No Valida' }).success).toBe(false);
  });

  it('rechaza category o q repetidos (arreglo en la query)', () => {
    expect(publicServicesQuerySchema.safeParse({ category: ['a', 'b'] }).success).toBe(false);
    expect(publicServicesQuerySchema.safeParse({ q: ['a', 'b'] }).success).toBe(false);
  });

  it('ignora claves desconocidas', () => {
    expect(publicServicesQuerySchema.parse({ otra: 'x' })).toEqual({});
  });
});
