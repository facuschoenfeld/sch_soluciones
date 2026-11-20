import { describe, expect, it } from 'vitest';
import { makeService } from '@/test/admin-fixtures';
import { filterServices, parseFilters, type ServiceFilters } from './admin-service-filters';

const base: ServiceFilters = { q: '', categoryId: null, status: 'todos', sort: 'sitio' };

const services = [
  makeService({
    id: 1,
    categoryId: 1,
    name: 'Reparación de notebook',
    slug: 'reparacion-notebook',
    shortDescription: 'Cambio de pantalla',
    sortOrder: 1,
    priceAmount: 50000,
    priceUpdatedAt: '2026-03-01T00:00:00.000Z',
  }),
  makeService({
    id: 2,
    categoryId: 1,
    name: 'Instalación de Windows',
    slug: 'windows',
    shortDescription: 'Sistema operativo limpio',
    sortOrder: 0,
    priceAmount: 30000,
    priceUpdatedAt: '2026-01-01T00:00:00.000Z',
  }),
  makeService({
    id: 3,
    categoryId: 2,
    name: 'Landing page',
    slug: 'landing',
    shortDescription: 'Página de presentación',
    sortOrder: 0,
    isActive: false,
    priceType: 'QUOTE',
    priceAmount: null,
    priceUpdatedAt: '2026-02-01T00:00:00.000Z',
  }),
  makeService({
    id: 4,
    categoryId: 2,
    name: 'Alojamiento',
    slug: 'hosting',
    shortDescription: 'Servidor web',
    sortOrder: 1,
    currency: 'USD',
    priceAmount: 10,
    priceUpdatedAt: '2026-04-01T00:00:00.000Z',
  }),
];

const ids = (list: { id: number }[]) => list.map((s) => s.id);

describe('filterServices', () => {
  it('sin filtros devuelve todo en el orden del sitio (categoría, sortOrder)', () => {
    expect(ids(filterServices(services, base))).toEqual([2, 1, 3, 4]);
  });

  it('no muta el arreglo original', () => {
    const copy = [...services];
    filterServices(services, { ...base, sort: 'nombre' });
    expect(services).toEqual(copy);
  });

  it('busca sin importar tildes ni mayúsculas', () => {
    expect(ids(filterServices(services, { ...base, q: 'REPARACION' }))).toEqual([1]);
    expect(ids(filterServices(services, { ...base, q: 'instalación' }))).toEqual([2]);
  });

  it('busca también en el slug y la descripción corta', () => {
    expect(ids(filterServices(services, { ...base, q: 'hosting' }))).toEqual([4]);
    expect(ids(filterServices(services, { ...base, q: 'pantalla' }))).toEqual([1]);
  });

  it('ignora espacios alrededor de la búsqueda y devuelve vacío si nada coincide', () => {
    expect(ids(filterServices(services, { ...base, q: '  landing  ' }))).toEqual([3]);
    expect(filterServices(services, { ...base, q: 'zzz' })).toEqual([]);
  });

  it('filtra por categoría', () => {
    expect(ids(filterServices(services, { ...base, categoryId: 2 }))).toEqual([3, 4]);
  });

  it('filtra por estado', () => {
    expect(ids(filterServices(services, { ...base, status: 'activos' }))).toEqual([2, 1, 4]);
    expect(ids(filterServices(services, { ...base, status: 'archivados' }))).toEqual([3]);
  });

  it('combina filtros', () => {
    const result = filterServices(services, {
      ...base,
      categoryId: 2,
      status: 'activos',
      q: 'alojamiento',
    });
    expect(ids(result)).toEqual([4]);
  });

  it('ordena por nombre', () => {
    expect(ids(filterServices(services, { ...base, sort: 'nombre' }))).toEqual([4, 2, 3, 1]);
  });

  it('ordena por precio: por moneda y monto, con "a consultar" al final', () => {
    // ARS 30000, ARS 50000, USD 10 y al final el "a consultar".
    expect(ids(filterServices(services, { ...base, sort: 'precio' }))).toEqual([2, 1, 4, 3]);
  });

  it('ordena por precio actualizado más viejo primero', () => {
    expect(ids(filterServices(services, { ...base, sort: 'actualizacion' }))).toEqual([2, 3, 1, 4]);
  });

  it('el orden del sitio respeta un reordenamiento de sortOrder dentro de la categoría', () => {
    const reordered = services.map((s) =>
      s.id === 1 ? { ...s, sortOrder: 0 } : s.id === 2 ? { ...s, sortOrder: 1 } : s,
    );
    expect(ids(filterServices(reordered, base))).toEqual([1, 2, 3, 4]);
  });
});

describe('parseFilters', () => {
  it('lee los valores válidos de la URL', () => {
    const filters = parseFilters(
      new URLSearchParams('q=win&categoria=2&estado=archivados&orden=precio'),
    );
    expect(filters).toEqual({ q: 'win', categoryId: 2, status: 'archivados', sort: 'precio' });
  });

  it('usa los valores por defecto si no hay parámetros', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(base);
  });

  it('los valores inválidos caen al default', () => {
    const filters = parseFilters(new URLSearchParams('categoria=abc&estado=otro&orden=inventado'));
    expect(filters).toEqual(base);
  });

  it.each(['0', '-3', '1.5', ''])('descarta la categoría "%s"', (value) => {
    expect(parseFilters(new URLSearchParams({ categoria: value })).categoryId).toBeNull();
  });

  // Regresión: `pick` usaba `value in options`, que acepta propiedades de Object.prototype.
  it('no toma propiedades heredadas como opciones válidas', () => {
    expect(parseFilters(new URLSearchParams('estado=toString&orden=constructor'))).toEqual(base);
  });
});
