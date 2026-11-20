import { describe, expect, it } from 'vitest';
import { PRICE_MAX, SLUG_MAX_LENGTH, isValidSlug } from './constraints.js';
import {
  applyPriceAdjustment,
  hasAtMostTwoDecimals,
  isValidAdjustedPrice,
} from './price-adjustment.js';
import { bulkPriceSchema, serviceInputSchema, settingsInputSchema } from './schemas.js';
import { slugify } from './slug.js';
import { whatsappNumberWarning } from './whatsapp.js';

describe('slugify', () => {
  it.each([
    ['Instalación de Windows 11', 'instalacion-de-windows-11'],
    ['Diseño & Señalética', 'diseno-senaletica'],
    ['  --Armado de PC--  ', 'armado-de-pc'],
    ['ÜBER  Ñandú', 'uber-nandu'],
    ['¡¿?!', ''],
  ])('"%s" → "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('respeta el largo máximo sin terminar en guion', () => {
    const slug = slugify(`${'a'.repeat(SLUG_MAX_LENGTH - 1)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe('applyPriceAdjustment', () => {
  it.each([
    [18500, 7.5, 19888], // 19.887,5 → redondea hacia arriba
    [25000, 10, 27500],
    [999.99, 7.5, 1075], // 1.074,99 → 1.075
    [1005, 10, 1106], // 1.105,5 exacto (en punto flotante daría 1.105,4999…)
    [10000, -15.25, 8475],
    [0, 50, 0],
  ])('%d con %d %% → %d', (amount, percent, expected) => {
    expect(applyPriceAdjustment(amount, { kind: 'PERCENT', value: percent })).toBe(expected);
  });

  it('suma o resta un monto fijo y redondea al entero', () => {
    expect(applyPriceAdjustment(25000, { kind: 'AMOUNT', value: 2000 })).toBe(27000);
    expect(applyPriceAdjustment(1500.5, { kind: 'AMOUNT', value: -500 })).toBe(1001);
    expect(applyPriceAdjustment(500, { kind: 'AMOUNT', value: -1000 })).toBe(-500);
  });

  it('es exacto con montos cercanos al máximo', () => {
    expect(applyPriceAdjustment(9_000_000_000, { kind: 'PERCENT', value: 11.11 })).toBe(
      9_999_900_000,
    );
  });

  it('isValidAdjustedPrice rechaza negativos y montos sobre el máximo', () => {
    expect(isValidAdjustedPrice(0)).toBe(true);
    expect(isValidAdjustedPrice(-1)).toBe(false);
    expect(isValidAdjustedPrice(PRICE_MAX + 1)).toBe(false);
  });

  it('hasAtMostTwoDecimals tolera el error de representación', () => {
    expect(hasAtMostTwoDecimals(0.1 + 0.2)).toBe(true);
    expect(hasAtMostTwoDecimals(19.99)).toBe(true);
    expect(hasAtMostTwoDecimals(1.005)).toBe(false);
    expect(hasAtMostTwoDecimals(Number.NaN)).toBe(false);
    // Montos grandes con centavos: el error de value * 100 supera una tolerancia fija.
    expect(hasAtMostTwoDecimals(1234567890.12)).toBe(true);
    expect(hasAtMostTwoDecimals(9_999_999_999.99)).toBe(true);
    expect(hasAtMostTwoDecimals(1234567.125)).toBe(false);
  });
});

describe('whatsappNumberWarning', () => {
  it.each([
    ['5491122334455', null],
    ['14155552671', null], // otro país
    ['01122334455', 'No va el 0'],
    ['541122334455', 'después del 54 va un 9'],
    ['54901122334455', 'Sacá el 0'],
    ['549111522334455', '13 dígitos'],
  ])('%s', (number, expected) => {
    const warning = whatsappNumberWarning(number);
    if (expected === null) expect(warning).toBeNull();
    else expect(warning).toContain(expected);
  });
});

describe('esquemas del panel', () => {
  const service = {
    categoryId: 1,
    name: 'Limpieza',
    slug: 'limpieza',
    shortDescription: 'Limpieza interna',
    description: '',
    priceType: 'FIXED',
    priceAmount: 1000,
    currency: 'ARS',
    priceUnit: '',
    estimatedTime: null,
    whatsappTemplate: '  ',
    isActive: true,
    isFeatured: false,
  } as const;

  it('serviceInputSchema convierte los opcionales vacíos en null', () => {
    const parsed = serviceInputSchema.parse(service);
    expect(parsed).toMatchObject({ priceUnit: null, estimatedTime: null, whatsappTemplate: null });
  });

  it('serviceInputSchema exige monto salvo en "a consultar"', () => {
    expect(serviceInputSchema.safeParse({ ...service, priceAmount: null }).success).toBe(false);
    expect(
      serviceInputSchema.safeParse({ ...service, priceType: 'QUOTE', priceAmount: null }).success,
    ).toBe(true);
  });

  it('bulkPriceSchema rechaza ids repetidos', () => {
    const result = bulkPriceSchema.safeParse({
      serviceIds: [1, 1],
      adjustment: { kind: 'PERCENT', value: 5 },
    });
    expect(result.success).toBe(false);
  });

  it('settingsInputSchema solo acepta links https', () => {
    const base = {
      businessName: 'SCH',
      tagline: null,
      whatsappNumber: '5491122334455',
      bookingWhatsappTemplate: '',
      inquiryWhatsappTemplate: '',
      generalWhatsappTemplate: '',
      heroTitle: 'Hola',
      heroSubtitle: null,
      aboutText: null,
      businessHours: null,
      serviceArea: null,
      instagramUrl: 'https://instagram.com/sch',
      githubUrl: null,
      linkedinUrl: null,
      email: '',
    };
    expect(settingsInputSchema.parse(base).email).toBeNull();
    for (const url of [
      'http://instagram.com/sch',
      'javascript:alert(1)',
      'https://localhost',
      'https://instagram.com@evil.com/sch',
    ]) {
      expect(settingsInputSchema.safeParse({ ...base, instagramUrl: url }).success).toBe(false);
    }
  });
});
