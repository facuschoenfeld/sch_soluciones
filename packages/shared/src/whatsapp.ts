/** Variables que se pueden usar en las plantillas de WhatsApp (visibles para el admin, en español). */
export const WHATSAPP_TEMPLATE_VARIABLES = ['servicio', 'precio', 'negocio'] as const;
export type WhatsappTemplateVariable = (typeof WHATSAPP_TEMPLATE_VARIABLES)[number];
export type WhatsappTemplateValues = Partial<Record<WhatsappTemplateVariable, string>>;

export const DEFAULT_BOOKING_WHATSAPP_TEMPLATE =
  '¡Hola! 👋 Vi en tu página el servicio "{{servicio}}" y quisiera reservar un turno 📅.';

export const DEFAULT_INQUIRY_WHATSAPP_TEMPLATE =
  '¡Hola! 👋 Vi en tu página el servicio "{{servicio}}" y tengo una consulta al respecto. *Describe abajo tu consulta* ⏬';

/** Para contactos sin un servicio puntual (botón flotante, CTA del inicio y de contacto). */
export const DEFAULT_GENERAL_WHATSAPP_TEMPLATE =
  '¡Hola! 👋 Vi tu página y quisiera hacerte una consulta. *Describe abajo tu consulta* ⏬';

// Admite espacios internos: {{servicio}} y {{ servicio }}.
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

function isTemplateVariable(name: string): name is WhatsappTemplateVariable {
  return (WHATSAPP_TEMPLATE_VARIABLES as readonly string[]).includes(name);
}

/**
 * Reemplaza las variables conocidas de la plantilla. Una variable conocida sin valor se
 * reemplaza por cadena vacía; una desconocida se deja tal cual para que el admin la vea.
 */
export function buildWhatsappMessage(template: string, values: WhatsappTemplateValues): string {
  // Con función de reemplazo: un valor como "$ 25.000" no se interpreta como patrón ($&, $1…).
  return template.replace(VARIABLE_PATTERN, (match, rawName: string) => {
    const name = rawName.toLowerCase();
    return isTemplateVariable(name) ? (values[name] ?? '') : match;
  });
}

/** Número en formato internacional sin "+", solo dígitos (ej. 5491122334455). */
const WHATSAPP_NUMBER_PATTERN = /^\d{8,15}$/;

export function isValidWhatsappNumber(number: string): boolean {
  return WHATSAPP_NUMBER_PATTERN.test(number);
}

/** Arma el link `wa.me` con el mensaje pre-cargado. */
export function buildWhatsappUrl(number: string, message: string): string {
  if (!isValidWhatsappNumber(number)) {
    throw new Error(`Número de WhatsApp inválido: debe tener solo dígitos (8 a 15).`);
  }
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Aviso (no bloqueante) para números de Argentina mal armados. En `wa.me` un celular va como
 * 549 + código de área sin el 0 + número sin el 15: 13 dígitos (ej. 5491122334455).
 * Devuelve null si no hay nada que advertir (incluye números de otros países).
 */
export function whatsappNumberWarning(number: string): string | null {
  if (number.startsWith('0')) {
    return 'No va el 0 inicial: empezá con el código de país (54 para Argentina).';
  }
  if (!number.startsWith('54')) return null;
  if (!number.startsWith('549')) {
    return 'Para un celular de Argentina, después del 54 va un 9 (ej. 5491122334455).';
  }
  if (number.startsWith('5490')) {
    return 'Sacá el 0 del código de área (ej. 549 11…, no 549 011…).';
  }
  if (number.length !== 13) {
    return 'Un celular de Argentina tiene 13 dígitos: 549 + código de área sin 0 + número sin 15.';
  }
  return null;
}
