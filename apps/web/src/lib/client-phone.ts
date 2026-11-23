import { buildWhatsappUrl, isValidWhatsappNumber, whatsappNumberWarning } from '@sch/shared';

/** Solo los dígitos (igual que la API al guardar). */
export function phoneDigits(value: string): string {
  return value.replace(/[\s().+-]/g, '');
}

/**
 * Aviso (no bloqueante) para poder escribirle por WhatsApp: `wa.me` necesita el número con
 * código de país. Un número argentino de 10 dígitos o menos casi seguro no lo tiene.
 */
export function clientPhoneWarning(value: string): string | null {
  const digits = phoneDigits(value);
  if (!/^\d+$/.test(digits)) return null;
  const warning = whatsappNumberWarning(digits);
  if (warning) return warning;
  if (digits.length <= 10) {
    return 'Sin código de país no se le puede escribir por WhatsApp: para un celular de Argentina va 549 + código de área sin 0 + número sin 15 (ej. 5491122334455).';
  }
  return null;
}

/** Link de WhatsApp para escribirle al cliente (null si el número no sirve para `wa.me`). */
export function clientWhatsappUrl(phone: string, fullName: string): string | null {
  if (!isValidWhatsappNumber(phone) || clientPhoneWarning(phone)) return null;
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';
  return buildWhatsappUrl(phone, firstName ? `¡Hola, ${firstName}! ` : '¡Hola! ');
}
