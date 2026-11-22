import { describe, expect, it } from 'vitest';
import { contactSettingsChanged } from './admin.js';

const base = { whatsappNumber: '5491122334455', email: 'hola@example.com' as string | null };

describe('contactSettingsChanged', () => {
  it('es false si el contacto es idéntico', () => {
    expect(contactSettingsChanged(base, { ...base })).toBe(false);
  });

  it('es false si ambos emails son null', () => {
    expect(contactSettingsChanged({ ...base, email: null }, { ...base, email: null })).toBe(false);
  });

  it('detecta un cambio de WhatsApp', () => {
    expect(contactSettingsChanged(base, { ...base, whatsappNumber: '5491199998888' })).toBe(true);
  });

  it('detecta un cambio solo de email', () => {
    expect(contactSettingsChanged(base, { ...base, email: 'otro@example.com' })).toBe(true);
  });

  it('email null contra un valor cuenta como cambio, en ambos sentidos', () => {
    expect(contactSettingsChanged({ ...base, email: null }, base)).toBe(true);
    expect(contactSettingsChanged(base, { ...base, email: null })).toBe(true);
  });

  it('ignora otros campos que lleguen en el objeto', () => {
    const before = { ...base, businessName: 'A' };
    const after = { ...base, businessName: 'B' };
    expect(contactSettingsChanged(before, after)).toBe(false);
  });
});
