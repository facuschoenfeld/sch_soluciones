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

// Catálogo (panel). Los textos largos tienen tope para que un pegado accidental no infle la base.
export const CATEGORY_NAME_MAX_LENGTH = 80;
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 500;
export const ICON_NAME_MAX_LENGTH = 50;
export const SERVICE_NAME_MAX_LENGTH = 120;
export const SERVICE_SHORT_DESCRIPTION_MAX_LENGTH = 300;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 20_000;
export const PRICE_UNIT_MAX_LENGTH = 60;
export const ESTIMATED_TIME_MAX_LENGTH = 60;
export const WHATSAPP_TEMPLATE_MAX_LENGTH = 1000;
/** Tope de `Decimal(12, 2)` en la base. */
export const PRICE_MAX = 9_999_999_999.99;
/** Máximo de ítems en un reordenamiento o una actualización masiva. */
export const BULK_MAX_ITEMS = 200;

// Configuración del negocio.
export const BUSINESS_NAME_MAX_LENGTH = 80;
export const TAGLINE_MAX_LENGTH = 160;
export const HERO_TITLE_MAX_LENGTH = 120;
export const HERO_SUBTITLE_MAX_LENGTH = 300;
export const ABOUT_TEXT_MAX_LENGTH = 3000;
export const SHORT_TEXT_MAX_LENGTH = 200;
export const URL_MAX_LENGTH = 300;
