import { describe, expect, it } from 'vitest';
import {
  clientSourceSchema,
  currencySchema,
  jobStatusSchema,
  priceTypeSchema,
  serviceLineSchema,
} from './index.js';

// Estos valores deben coincidir con los enums del esquema de Prisma.
describe('enums compartidos', () => {
  it('mantiene los valores acordados con el esquema de la base', () => {
    expect(serviceLineSchema.options).toEqual(['DEVELOPMENT', 'TECH_SUPPORT']);
    expect(priceTypeSchema.options).toEqual(['FIXED', 'FROM', 'QUOTE']);
    expect(currencySchema.options).toEqual(['ARS', 'USD']);
    expect(clientSourceSchema.options).toEqual(['WHATSAPP', 'REFERRAL', 'WEB', 'OTHER']);
    expect(jobStatusSchema.options).toEqual([
      'QUOTED',
      'SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'DELIVERED',
      'CANCELLED',
    ]);
  });

  it('rechaza valores fuera del enum', () => {
    expect(currencySchema.safeParse('EUR').success).toBe(false);
    expect(jobStatusSchema.safeParse('DONE').success).toBe(false);
  });
});
