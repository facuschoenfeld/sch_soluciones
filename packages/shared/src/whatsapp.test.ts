import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  buildWhatsappMessage,
  buildWhatsappUrl,
  isValidWhatsappNumber,
} from './whatsapp.js';

describe('buildWhatsappMessage', () => {
  it('reemplaza las variables de la plantilla de reserva por defecto', () => {
    expect(
      buildWhatsappMessage(DEFAULT_BOOKING_WHATSAPP_TEMPLATE, {
        servicio: 'Instalación de Windows',
      }),
    ).toBe(
      '¡Hola! 👋 Vi en tu página el servicio "Instalación de Windows" y quisiera reservar un turno 📅.',
    );
  });

  it('reemplaza en la plantilla de consulta por defecto', () => {
    const message = buildWhatsappMessage(DEFAULT_INQUIRY_WHATSAPP_TEMPLATE, {
      servicio: 'Landing page',
    });
    expect(message).toContain('"Landing page"');
    expect(message).not.toContain('{{');
  });

  it('reemplaza todas las apariciones y admite espacios dentro de las llaves', () => {
    expect(
      buildWhatsappMessage('{{servicio}} - {{ servicio }} en {{negocio}} ({{precio}})', {
        servicio: 'Limpieza',
        negocio: 'SCH',
        precio: 'Desde $ 10.000',
      }),
    ).toBe('Limpieza - Limpieza en SCH (Desde $ 10.000)');
  });

  it('no interpreta patrones especiales de reemplazo en los valores ($&, $1)', () => {
    expect(buildWhatsappMessage('Precio: {{precio}}', { precio: '$& $1 $$' })).toBe(
      'Precio: $& $1 $$',
    );
  });

  it('reemplaza por vacío una variable conocida sin valor', () => {
    expect(buildWhatsappMessage('Precio: {{precio}}.', {})).toBe('Precio: .');
  });

  it('deja intactas las variables desconocidas', () => {
    expect(buildWhatsappMessage('Hola {{nombre}}', { servicio: 'x' })).toBe('Hola {{nombre}}');
  });

  it('acepta variables en mayúsculas', () => {
    expect(buildWhatsappMessage('{{SERVICIO}}', { servicio: 'Armado de PC' })).toBe('Armado de PC');
  });
});

describe('buildWhatsappUrl', () => {
  const number = '5491122334455';

  it('arma el link wa.me con el texto codificado', () => {
    expect(buildWhatsappUrl(number, 'Hola mundo')).toBe(
      'https://wa.me/5491122334455?text=Hola%20mundo',
    );
  });

  it('codifica tildes, ñ, signos y saltos de línea', () => {
    const url = buildWhatsappUrl(number, '¿Reparación?\nSí, año 2026 & más');
    expect(url).toBe(
      'https://wa.me/5491122334455?text=%C2%BFReparaci%C3%B3n%3F%0AS%C3%AD%2C%20a%C3%B1o%202026%20%26%20m%C3%A1s',
    );
  });

  it('codifica emojis y el mensaje se recupera idéntico', () => {
    const message = buildWhatsappMessage(DEFAULT_BOOKING_WHATSAPP_TEMPLATE, {
      servicio: 'Formateo "rápido"',
    });
    const url = new URL(buildWhatsappUrl(number, message));
    expect(url.hostname).toBe('wa.me');
    expect(url.pathname).toBe(`/${number}`);
    expect(url.searchParams.get('text')).toBe(message);
    expect(url.search).not.toMatch(/[👋📅"\s]/u);
  });

  it('omite el parámetro text si el mensaje está vacío', () => {
    expect(buildWhatsappUrl(number, '')).toBe('https://wa.me/5491122334455');
  });

  it.each(['+5491122334455', '549 11 2233 4455', '1234567', '', '5491122334455999'])(
    'rechaza el número inválido %j',
    (invalid) => {
      expect(isValidWhatsappNumber(invalid)).toBe(false);
      expect(() => buildWhatsappUrl(invalid, 'hola')).toThrow(/inválido/);
    },
  );
});
