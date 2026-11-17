import { z } from 'zod';

// Espejo de los enums de Prisma (apps/api/prisma/schema.prisma).
// Si se modifica uno, hay que actualizar el otro: el test de enums.test.ts fija los valores.

export const serviceLineSchema = z.enum(['DEVELOPMENT', 'TECH_SUPPORT']);
export type ServiceLine = z.infer<typeof serviceLineSchema>;

export const priceTypeSchema = z.enum(['FIXED', 'FROM', 'QUOTE']);
export type PriceType = z.infer<typeof priceTypeSchema>;

export const currencySchema = z.enum(['ARS', 'USD']);
export type Currency = z.infer<typeof currencySchema>;

export const clientSourceSchema = z.enum(['WHATSAPP', 'REFERRAL', 'WEB', 'OTHER']);
export type ClientSource = z.infer<typeof clientSourceSchema>;

export const jobStatusSchema = z.enum([
  'QUOTED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;
