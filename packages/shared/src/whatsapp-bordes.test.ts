import { describe, expect, it } from 'vitest';
import { buildWhatsappMessage } from './whatsapp.js';

describe('buildWhatsappMessage: bordes', () => {
  it('una plantilla vacía devuelve cadena vacía', () => {
    expect(buildWhatsappMessage('', { servicio: 'X' })).toBe('');
  });

  it('una plantilla sin variables queda igual', () => {
    expect(buildWhatsappMessage('Hola, quiero info', { servicio: 'X' })).toBe('Hola, quiero info');
  });

  it.each(['{{servicio', '{servicio}}', '{{servicio}', 'servicio}}', '{{ servicio'])(
    'llaves sin cerrar o incompletas (%j) se dejan tal cual',
    (plantilla) => {
      expect(buildWhatsappMessage(plantilla, { servicio: 'X' })).toBe(plantilla);
    },
  );

  it('una variable vacía {{}} se deja tal cual', () => {
    expect(buildWhatsappMessage('a {{}} b', { servicio: 'X' })).toBe('a {{}} b');
    expect(buildWhatsappMessage('a {{  }} b', { servicio: 'X' })).toBe('a {{  }} b');
  });

  it('una variable desconocida se deja tal cual', () => {
    expect(buildWhatsappMessage('{{otra}} {{servicio}}', { servicio: 'X' })).toBe('{{otra}} X');
  });

  it('una variable conocida sin valor se reemplaza por vacío', () => {
    expect(buildWhatsappMessage('[{{precio}}]', {})).toBe('[]');
  });

  it('reemplaza todas las apariciones, con espacios internos y sin distinguir mayúsculas', () => {
    expect(
      buildWhatsappMessage('{{servicio}}, {{ Servicio }}, {{SERVICIO}}', { servicio: 'X' }),
    ).toBe('X, X, X');
  });

  it('los valores con patrones de reemplazo ($&, $1) se insertan literalmente', () => {
    expect(buildWhatsappMessage('{{precio}}', { precio: '$& $1 $$' })).toBe('$& $1 $$');
  });

  it('un valor que contiene una variable no se reemplaza recursivamente', () => {
    expect(buildWhatsappMessage('{{servicio}}', { servicio: '{{precio}}', precio: 'P' })).toBe(
      '{{precio}}',
    );
  });

  it('llaves triples: reemplaza la variable interna y conserva las llaves sobrantes', () => {
    expect(buildWhatsappMessage('{{{servicio}}}', { servicio: 'X' })).toBe('{X}');
  });
});
