import { describe, expect, it } from 'vitest';
import { safeAdminRedirect } from './auth';

describe('safeAdminRedirect', () => {
  it.each([
    '/admin',
    '/admin/',
    '/admin/servicios',
    '/admin/configuracion?tab=1',
    '/admin?x=1',
    '/admin#seccion',
  ])('acepta %s', (next) => {
    expect(safeAdminRedirect(next)).toBe(next);
  });

  it.each([
    ['null', null],
    ['vacío', ''],
    ['raíz', '/'],
    ['protocolo relativo', '//evil.com'],
    ['protocolo relativo bajo admin', '//admin/x'],
    ['login', '/admin/login'],
    ['login con query', '/admin/login?next=/admin'],
    ['URL absoluta', 'https://evil.com/admin'],
    ['otro sitio', 'https://evil.com'],
    ['backslash', String.raw`/admin\evil.com`],
    ['backslash inicial', String.raw`/\evil.com`],
    ['prefijo parecido', '/administrador'],
    ['otra ruta pública', '/servicios'],
    ['sin barra inicial', 'admin/servicios'],
  ])('rechaza %s y vuelve a /admin', (_caso, next) => {
    expect(safeAdminRedirect(next)).toBe('/admin');
  });
});
