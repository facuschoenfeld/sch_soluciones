import { z } from 'zod';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .max(120)
  .regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones (ej. "instalacion-de-windows")');

/** Query de `GET /api/public/services`. Los strings vacíos se tratan como ausentes. */
export const publicServicesQuerySchema = z.object({
  category: z.preprocess((value) => (value === '' ? undefined : value), slugSchema.optional()),
  q: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
});
export type PublicServicesQuery = z.infer<typeof publicServicesQuerySchema>;
