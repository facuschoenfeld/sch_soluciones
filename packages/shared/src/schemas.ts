import { z } from 'zod';
import {
  ABOUT_TEXT_MAX_LENGTH,
  BULK_MAX_ITEMS,
  BUSINESS_NAME_MAX_LENGTH,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  ESTIMATED_TIME_MAX_LENGTH,
  HERO_SUBTITLE_MAX_LENGTH,
  HERO_TITLE_MAX_LENGTH,
  ICON_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PRICE_MAX,
  PRICE_UNIT_MAX_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_SHORT_DESCRIPTION_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  TAGLINE_MAX_LENGTH,
  URL_MAX_LENGTH,
  WHATSAPP_TEMPLATE_MAX_LENGTH,
} from './constraints.js';
import { currencySchema, priceTypeSchema, serviceLineSchema, type PriceType } from './enums.js';
import {
  PRICE_ADJUSTMENT_PERCENT_MAX,
  PRICE_ADJUSTMENT_PERCENT_MIN,
  hasAtMostTwoDecimals,
} from './price-adjustment.js';
export const slugSchema = z
  .string()
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones (ej. "instalacion-de-windows")');

/** Query de `GET /api/public/services`. Los strings vacíos se tratan como ausentes. */
export const publicServicesQuerySchema = z.object({
  category: z.preprocess((value) => (value === '' ? undefined : value), slugSchema.optional()),
  q: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(SEARCH_QUERY_MAX_LENGTH).optional(),
  ),
});
export type PublicServicesQuery = z.infer<typeof publicServicesQuerySchema>;

/** Email normalizado igual que en el seed: sin espacios y en minúsculas. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Ingresá un email válido').max(EMAIL_MAX_LENGTH));

/** `POST /api/auth/login`. La contraseña no se valida en largo mínimo: solo se compara. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresá la contraseña').max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres`);

/** `POST /api/admin/password`. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual').max(PASSWORD_MAX_LENGTH),
    newPassword: newPasswordSchema,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'La nueva contraseña tiene que ser distinta de la actual',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Panel: catálogo y configuración. Los mensajes son los que ve el admin en el formulario.

const maxMessage = (max: number) => `Hasta ${max.toLocaleString('es-AR')} caracteres`;

function requiredText(max: number, emptyMessage: string) {
  return z.string().trim().min(1, emptyMessage).max(max, maxMessage(max));
}

/** Texto opcional: vacío (o solo espacios) se guarda como null. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, maxMessage(max))
    .nullable()
    .transform((value) => value || null);
}

/** Slug editable desde el panel (con mensaje para el campo vacío). */
const editableSlugSchema = z
  .string()
  .trim()
  .min(1, 'Ingresá el slug')
  .max(SLUG_MAX_LENGTH, maxMessage(SLUG_MAX_LENGTH))
  .regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones (ej. "instalacion-de-windows")');

/** Ids de la base: `int4` de Postgres (un número más grande daría error 500 en Prisma). */
const ID_MAX = 2_147_483_647;
const idSchema = z.number().int().positive().max(ID_MAX);

const idListSchema = z
  .array(idSchema)
  .min(1, 'Elegí al menos un elemento')
  .max(BULK_MAX_ITEMS)
  .refine((ids) => new Set(ids).size === ids.length, 'Hay elementos repetidos');

/** Nombre de ícono de lucide en kebab-case (el panel ofrece una lista cerrada). */
const iconSchema = z
  .string()
  .trim()
  .max(ICON_NAME_MAX_LENGTH)
  .regex(/^[a-z0-9-]*$/, 'Ícono inválido')
  .nullable()
  .transform((value) => value || null);

/** `POST /api/admin/categories`. */
export const categoryInputSchema = z.object({
  name: requiredText(CATEGORY_NAME_MAX_LENGTH, 'Ingresá el nombre'),
  slug: editableSlugSchema,
  description: optionalText(CATEGORY_DESCRIPTION_MAX_LENGTH),
  icon: iconSchema,
  line: serviceLineSchema,
  isActive: z.boolean(),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;
export type CategoryInputParsed = z.output<typeof categoryInputSchema>;

/** `PATCH /api/admin/categories/:id`: cualquier subconjunto de campos. */
export const categoryUpdateSchema = categoryInputSchema.partial();
export type CategoryUpdate = z.input<typeof categoryUpdateSchema>;
export type CategoryUpdateParsed = z.output<typeof categoryUpdateSchema>;

/** `PUT /api/admin/categories/order`: todas las categorías, en el orden nuevo. */
export const reorderSchema = z.object({ ids: idListSchema });
export type ReorderInput = z.infer<typeof reorderSchema>;

/** `PUT /api/admin/services/order`: todos los servicios de una categoría, en el orden nuevo. */
export const serviceReorderSchema = z.object({ categoryId: idSchema, ids: idListSchema });
export type ServiceReorderInput = z.infer<typeof serviceReorderSchema>;

export const priceAmountSchema = z
  .number({ error: 'Ingresá un monto válido' })
  .min(0, 'El precio no puede ser negativo')
  .max(PRICE_MAX, 'El monto es demasiado grande')
  .refine(hasAtMostTwoDecimals, 'Hasta 2 decimales');

/**
 * Regla de precio: FIXED y FROM llevan monto. En QUOTE el monto se ignora (la API lo guarda
 * como null, como exige la restricción CHECK de la base).
 */
export function servicePriceIssue(priceType: PriceType, priceAmount: number | null): string | null {
  return priceType !== 'QUOTE' && priceAmount === null
    ? 'Ingresá el precio (o elegí "A consultar")'
    : null;
}

const serviceFieldsSchema = z.object({
  categoryId: z
    .number({ error: 'Elegí una categoría' })
    .int()
    .positive('Elegí una categoría')
    .max(ID_MAX, 'Elegí una categoría'),
  name: requiredText(SERVICE_NAME_MAX_LENGTH, 'Ingresá el nombre'),
  slug: editableSlugSchema,
  shortDescription: requiredText(
    SERVICE_SHORT_DESCRIPTION_MAX_LENGTH,
    'Ingresá una descripción corta',
  ),
  /** Markdown. */
  description: z
    .string()
    .trim()
    .max(SERVICE_DESCRIPTION_MAX_LENGTH, maxMessage(SERVICE_DESCRIPTION_MAX_LENGTH)),
  priceType: priceTypeSchema,
  priceAmount: priceAmountSchema.nullable(),
  currency: currencySchema,
  priceUnit: optionalText(PRICE_UNIT_MAX_LENGTH),
  estimatedTime: optionalText(ESTIMATED_TIME_MAX_LENGTH),
  /** Plantilla de reserva propia; null = la global de Configuración. */
  whatsappTemplate: optionalText(WHATSAPP_TEMPLATE_MAX_LENGTH),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});

/** `POST /api/admin/services`. */
export const serviceInputSchema = serviceFieldsSchema.superRefine((value, ctx) => {
  const issue = servicePriceIssue(value.priceType, value.priceAmount);
  if (issue) ctx.addIssue({ code: 'custom', path: ['priceAmount'], message: issue });
});
export type ServiceInput = z.input<typeof serviceInputSchema>;
export type ServiceInputParsed = z.output<typeof serviceInputSchema>;

/**
 * `PATCH /api/admin/services/:id`: cualquier subconjunto de campos. La regla de precio se
 * verifica en la API contra el servicio ya combinado con los cambios.
 */
export const serviceUpdateSchema = serviceFieldsSchema.partial();
export type ServiceUpdate = z.input<typeof serviceUpdateSchema>;
export type ServiceUpdateParsed = z.output<typeof serviceUpdateSchema>;

const adjustmentValue = (min: number, max: number) =>
  z
    .number({ error: 'Ingresá un número' })
    .min(min, `El mínimo es ${min.toLocaleString('es-AR')}`)
    .max(max, `El máximo es ${max.toLocaleString('es-AR')}`)
    .refine((value) => value !== 0, 'El ajuste no puede ser 0')
    .refine(hasAtMostTwoDecimals, 'Hasta 2 decimales');

/** `POST /api/admin/services/bulk-price`. */
export const bulkPriceSchema = z.object({
  serviceIds: idListSchema,
  adjustment: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('PERCENT'),
      value: adjustmentValue(PRICE_ADJUSTMENT_PERCENT_MIN, PRICE_ADJUSTMENT_PERCENT_MAX),
    }),
    z.object({ kind: z.literal('AMOUNT'), value: adjustmentValue(-PRICE_MAX, PRICE_MAX) }),
  ]),
});
export type BulkPriceInput = z.infer<typeof bulkPriceSchema>;

// `URL` es global en Node y en el navegador, pero el build de shared no incluye los tipos de
// ninguno de los dos (ver tsconfig.json): se declara solo lo que se usa.
declare const URL: new (input: string) => {
  protocol: string;
  hostname: string;
  username: string;
  password: string;
};

/** Link https absoluto (las redes se muestran como links: nada de http:, javascript:, etc.). */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Sin usuario/contraseña: "https://instagram.com@evil.com" en realidad va a evil.com.
    return (
      url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, maxMessage(URL_MAX_LENGTH))
  .refine((value) => value === '' || isHttpsUrl(value), 'Ingresá un link completo con https://')
  .nullable()
  .transform((value) => value || null);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.union([z.literal(''), z.email('Ingresá un email válido').max(EMAIL_MAX_LENGTH)]))
  .nullable()
  .transform((value) => value || null);

/** Vacía = se usa la plantilla de fábrica (`DEFAULT_*_WHATSAPP_TEMPLATE`). */
const templateSchema = z
  .string()
  .trim()
  .max(WHATSAPP_TEMPLATE_MAX_LENGTH, maxMessage(WHATSAPP_TEMPLATE_MAX_LENGTH));

/** Número de WhatsApp: se aceptan espacios, guiones, paréntesis y "+"; se guardan solo los dígitos. */
export const whatsappNumberSchema = z
  .string()
  .transform((value) => value.replace(/[\s()+-]/g, ''))
  .pipe(
    z
      .string()
      .min(1, 'Ingresá el número de WhatsApp')
      .regex(/^\d{8,15}$/, 'Solo números, con código de país (ej. 5491122334455)'),
  );

/** `PUT /api/admin/settings`. */
export const settingsInputSchema = z.object({
  businessName: requiredText(BUSINESS_NAME_MAX_LENGTH, 'Ingresá el nombre del negocio'),
  tagline: optionalText(TAGLINE_MAX_LENGTH),
  whatsappNumber: whatsappNumberSchema,
  bookingWhatsappTemplate: templateSchema,
  inquiryWhatsappTemplate: templateSchema,
  generalWhatsappTemplate: templateSchema,
  heroTitle: requiredText(HERO_TITLE_MAX_LENGTH, 'Ingresá el título principal'),
  heroSubtitle: optionalText(HERO_SUBTITLE_MAX_LENGTH),
  aboutText: optionalText(ABOUT_TEXT_MAX_LENGTH),
  businessHours: optionalText(SHORT_TEXT_MAX_LENGTH),
  serviceArea: optionalText(SHORT_TEXT_MAX_LENGTH),
  instagramUrl: optionalHttpsUrl,
  githubUrl: optionalHttpsUrl,
  linkedinUrl: optionalHttpsUrl,
  email: optionalEmail,
});
export type SettingsInput = z.input<typeof settingsInputSchema>;
export type SettingsInputParsed = z.output<typeof settingsInputSchema>;
