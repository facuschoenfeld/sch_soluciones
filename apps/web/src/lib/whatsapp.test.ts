import { DEFAULT_BOOKING_WHATSAPP_TEMPLATE, DEFAULT_GENERAL_WHATSAPP_TEMPLATE } from '@sch/shared';
import { describe, expect, it } from 'vitest';
import { landingService, settingsFixture, windowsService } from '@/test/fixtures';
import { buildInitialMessage } from './whatsapp';

// Espacio no separable que usa Intl entre el símbolo y el monto.
const NBSP = String.fromCharCode(0xa0);

describe('buildInitialMessage', () => {
  it('"Reservar turno" usa la plantilla global de reserva con el servicio insertado', () => {
    expect(buildInitialMessage(settingsFixture, windowsService, 'booking')).toBe(
      '¡Hola! 👋 Vi en tu página el servicio "Instalación de Windows" y quisiera reservar un turno 📅.',
    );
  });

  it('"Hacer una consulta" usa la plantilla global de consulta', () => {
    const message = buildInitialMessage(settingsFixture, landingService, 'inquiry');
    expect(message).toContain('"Landing page"');
    expect(message).toContain('tengo una consulta');
  });

  it('la plantilla propia del servicio reemplaza solo a la de reserva', () => {
    const service = {
      ...windowsService,
      whatsappTemplate: 'Quiero {{servicio}} ({{precio}}) con {{negocio}}',
    };
    expect(buildInitialMessage(settingsFixture, service, 'booking')).toBe(
      `Quiero Instalación de Windows ($${NBSP}30.000 por equipo) con SCH Soluciones`,
    );
    expect(buildInitialMessage(settingsFixture, service, 'inquiry')).toContain(
      'tengo una consulta',
    );
  });

  it('sin servicio usa la plantilla general', () => {
    expect(buildInitialMessage(settingsFixture, null, 'booking')).toBe(
      DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
    );
  });

  it('si una plantilla quedó vacía o en blanco usa la de fábrica', () => {
    const settings = {
      ...settingsFixture,
      bookingWhatsappTemplate: '   ',
      generalWhatsappTemplate: '',
    };
    const service = { ...windowsService, whatsappTemplate: '' };

    expect(buildInitialMessage(settings, service, 'booking')).toBe(
      DEFAULT_BOOKING_WHATSAPP_TEMPLATE.replace('{{servicio}}', 'Instalación de Windows'),
    );
    expect(buildInitialMessage(settings, null, 'inquiry')).toBe(DEFAULT_GENERAL_WHATSAPP_TEMPLATE);
  });
});
