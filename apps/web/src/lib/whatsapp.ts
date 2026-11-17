import {
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  buildWhatsappMessage,
  formatPrice,
  type PublicServiceSummary,
  type PublicSettings,
} from '@sch/shared';

/** Opciones rápidas del diálogo de WhatsApp. */
export type WhatsappIntent = 'booking' | 'inquiry';

export const WHATSAPP_INTENT_LABELS: Record<WhatsappIntent, string> = {
  booking: 'Reservar turno',
  inquiry: 'Hacer una consulta',
};

/** Primera plantilla con contenido (una plantilla vacía se trata como no configurada). */
function firstFilled(...templates: (string | null | undefined)[]): string {
  return templates.find((template) => template && template.trim() !== '') ?? '';
}

/**
 * Mensaje inicial del diálogo.
 * - Con servicio: "Reservar turno" usa la plantilla del servicio o, si no tiene, la global de
 *   reserva; "Hacer una consulta" usa siempre la global de consulta.
 * - Sin servicio (botón flotante, CTA generales): la plantilla general.
 * Si una plantilla de Settings quedó vacía se usa la de fábrica.
 */
export function buildInitialMessage(
  settings: PublicSettings,
  service: PublicServiceSummary | null,
  intent: WhatsappIntent,
): string {
  const negocio = settings.businessName;

  if (!service) {
    return buildWhatsappMessage(
      firstFilled(settings.generalWhatsappTemplate, DEFAULT_GENERAL_WHATSAPP_TEMPLATE),
      { negocio },
    );
  }

  const template =
    intent === 'booking'
      ? firstFilled(
          service.whatsappTemplate,
          settings.bookingWhatsappTemplate,
          DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
        )
      : firstFilled(settings.inquiryWhatsappTemplate, DEFAULT_INQUIRY_WHATSAPP_TEMPLATE);

  return buildWhatsappMessage(template, {
    servicio: service.name,
    precio: formatPrice(service),
    negocio,
  });
}
