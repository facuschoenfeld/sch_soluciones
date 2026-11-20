import { SLUG_MAX_LENGTH } from './constraints.js';

/**
 * Genera un slug a partir de un nombre: "Instalación de Windows 11" → "instalacion-de-windows-11".
 * Quita tildes (también la ñ → n), pasa a minúsculas y une las palabras con guiones. El resultado
 * cumple `SLUG_PATTERN` o es cadena vacía (si el nombre no tiene letras ni números).
 */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      // Marcas diacríticas combinables (tildes, diéresis, la virgulilla de la ñ).
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, SLUG_MAX_LENGTH)
      // Sin guiones al principio ni al final (tampoco si el corte dejó uno).
      .replace(/^-+|-+$/g, '')
  );
}
