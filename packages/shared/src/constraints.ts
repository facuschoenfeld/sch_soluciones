// Límites compartidos sin dependencias: el front los usa sin incluir Zod en el bundle, y la API
// los aplica en sus esquemas. Así el front nunca pide algo que la API rechazaría con 400.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 120;
export const SEARCH_QUERY_MAX_LENGTH = 100;

export function isValidSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

// Contraseña del admin. El máximo evita gastar argon2 (CPU y ~19 MiB de memoria por
// verificación) en entradas enormes.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;
export const EMAIL_MAX_LENGTH = 254;
