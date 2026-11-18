import { z } from 'zod';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from './constraints.js';

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
