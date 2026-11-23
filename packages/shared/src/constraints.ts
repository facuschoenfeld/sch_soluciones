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

// Clientes y trabajos (mini CRM).
export const CLIENT_NAME_MAX_LENGTH = 120;
/** Teléfono: solo dígitos (se guardan sin espacios ni guiones), con o sin código de país. */
export const PHONE_MIN_DIGITS = 6;
export const PHONE_MAX_DIGITS = 15;
export const ADDRESS_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 5000;
export const JOB_TITLE_MAX_LENGTH = 160;
export const JOB_DESCRIPTION_MAX_LENGTH = 5000;
export const DEVICE_FIELD_MAX_LENGTH = 120;
export const REPORTED_ISSUE_MAX_LENGTH = 1000;

// Paginación de los listados del panel.
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_MAX = 100;
/** Tope de página: evita OFFSET enormes (un número así no tiene sentido con estos volúmenes). */
export const PAGE_MAX = 10_000;
/** Filas máximas de una exportación a CSV; con más, se pide filtrar. */
export const EXPORT_MAX_ROWS = 5000;
/**
 * Filas máximas de un PDF: pdfkit es síncrono y con miles de filas bloquea la única instancia
 * de la API (y el sitio público) durante segundos y usa cientos de MB.
 */
export const PDF_EXPORT_MAX_ROWS = 1000;
