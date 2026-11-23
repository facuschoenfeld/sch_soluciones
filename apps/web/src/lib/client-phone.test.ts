import { describe, expect, it } from 'vitest';
import { clientPhoneWarning, clientWhatsappUrl, phoneDigits } from './client-phone';

describe('phoneDigits', () => {
  it('quita espacios, paréntesis, guiones y el +', () => {
    expect(phoneDigits('+54 (11) 2233-4455')).toBe('541122334455');
  });
});

describe('clientPhoneWarning', () => {
  it('un número de 10 dígitos (sin código de país) avisa que no sirve para WhatsApp', () => {
    expect(clientPhoneWarning('1122334455')).toContain('Sin código de país');
  });

  it('un celular argentino bien armado (13 dígitos) no avisa', () => {
    expect(clientPhoneWarning('5491122334455')).toBeNull();
  });

  it('54 sin 9 avisa (la advertencia de WhatsApp tiene prioridad)', () => {
    expect(clientPhoneWarning('541122334455')).toContain('va un 9');
  });

  it('un 0 inicial avisa', () => {
    expect(clientPhoneWarning('01122334455')).toContain('0 inicial');
  });

  it('acepta el número con separadores', () => {
    expect(clientPhoneWarning('+54 9 11 2233-4455')).toBeNull();
  });

  it('un número de otro país con más de 10 dígitos no avisa', () => {
    expect(clientPhoneWarning('59899123456')).toBeNull();
  });

  it('texto que no son dígitos no avisa (lo valida el esquema)', () => {
    expect(clientPhoneWarning('abc')).toBeNull();
    expect(clientPhoneWarning('')).toBeNull();
  });
});

describe('clientWhatsappUrl', () => {
  it('arma el link con el saludo al primer nombre', () => {
    const url = clientWhatsappUrl('5491122334455', 'Ana María Pérez');
    expect(url).toBe(`https://wa.me/5491122334455?text=${encodeURIComponent('¡Hola, Ana! ')}`);
  });

  it('sin nombre usa un saludo genérico', () => {
    expect(clientWhatsappUrl('5491122334455', '   ')).toBe(
      `https://wa.me/5491122334455?text=${encodeURIComponent('¡Hola! ')}`,
    );
  });

  it('null sin código de país', () => {
    expect(clientWhatsappUrl('1122334455', 'Ana')).toBeNull();
  });

  it('null con un número armado mal (54 sin 9)', () => {
    expect(clientWhatsappUrl('541122334455', 'Ana')).toBeNull();
  });

  it('null si no es un número válido para wa.me', () => {
    expect(clientWhatsappUrl('abc', 'Ana')).toBeNull();
    expect(clientWhatsappUrl('123', 'Ana')).toBeNull();
  });
});
