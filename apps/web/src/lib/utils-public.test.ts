import { describe, expect, it } from 'vitest';
import {
  categoriesFixture,
  landingService,
  settingsFixture,
  windowsService,
} from '@/test/fixtures';
import { getCategoryIcon } from './category-icons';
import { getContactLinks } from './contact-links';
import { ApiError } from './api-client';
import { shouldRetry } from './query-client';
import { safeExternalUrl } from './safe-url';
import {
  filterCategoriesByLine,
  filterServicesByLine,
  lineParamFor,
  parseLineParam,
} from './service-filters';

describe('filtros por línea', () => {
  it('traduce el parámetro de la URL y vuelve a armarlo', () => {
    expect(parseLineParam('desarrollo')).toBe('DEVELOPMENT');
    expect(parseLineParam('servicio-tecnico')).toBe('TECH_SUPPORT');
    expect(lineParamFor('DEVELOPMENT')).toBe('desarrollo');
    expect(lineParamFor('TECH_SUPPORT')).toBe('servicio-tecnico');
  });

  it('un valor desconocido o heredado del prototipo equivale a "todas"', () => {
    expect(parseLineParam(null)).toBeNull();
    expect(parseLineParam('')).toBeNull();
    expect(parseLineParam('otra')).toBeNull();
    expect(parseLineParam('toString')).toBeNull();
  });

  it('filtra categorías y servicios por línea', () => {
    const services = [windowsService, landingService];
    expect(filterServicesByLine(services, 'DEVELOPMENT')).toEqual([landingService]);
    expect(filterServicesByLine(services, null)).toEqual(services);
    expect(filterCategoriesByLine(categoriesFixture, 'TECH_SUPPORT').map((c) => c.slug)).toEqual([
      'reparacion',
    ]);
  });
});

describe('safeExternalUrl', () => {
  it('acepta http y https', () => {
    expect(safeExternalUrl('https://instagram.com/sch')).toBe('https://instagram.com/sch');
    expect(safeExternalUrl('  http://example.com ')).toBe('http://example.com/');
  });

  it('descarta otros protocolos, textos inválidos y vacíos', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,hola')).toBeNull();
    expect(safeExternalUrl('instagram.com/sch')).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe('getContactLinks', () => {
  it('incluye solo redes con URL segura y el email', () => {
    expect(getContactLinks(settingsFixture)).toEqual([
      { label: 'Instagram', href: 'https://instagram.com/sch', external: true },
      { label: 'hola@example.com', href: 'mailto:hola@example.com', external: false },
    ]);
  });
});

describe('getCategoryIcon', () => {
  it('devuelve un ícono genérico si el nombre no existe', () => {
    expect(getCategoryIcon('globe')).not.toBe(getCategoryIcon('no-existe'));
    expect(getCategoryIcon(null)).toBe(getCategoryIcon('no-existe'));
  });
});

describe('shouldRetry', () => {
  it('no reintenta errores 4xx y reintenta una vez los demás', () => {
    expect(shouldRetry(0, new ApiError(404, 'SERVICE_NOT_FOUND', 'No existe'))).toBe(false);
    expect(shouldRetry(0, new ApiError(503, 'DB_UNAVAILABLE', 'Sin base'))).toBe(true);
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetry(1, new TypeError('Failed to fetch'))).toBe(false);
  });
});
