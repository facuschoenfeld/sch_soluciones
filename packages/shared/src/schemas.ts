import { z } from 'zod';
import { SEARCH_QUERY_MAX_LENGTH, SLUG_MAX_LENGTH, SLUG_PATTERN } from './constraints.js';

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
