import { describe, expect, it } from 'vitest';
import {
  CLIENTS_PAGE_SIZE,
  JOBS_PAGE_SIZE,
  clientsApiQuery,
  clientsExportQuery,
  hasJobsFilters,
  isCompleteFilterDate,
  isDateRangeInverted,
  jobsApiQuery,
  jobsExportQuery,
  parseClientsFilters,
  parseJobsFilters,
  type JobsUrlFilters,
} from './crm-filters';

const parse = (query: string) => parseJobsFilters(new URLSearchParams(query));

const NO_FILTERS: JobsUrlFilters = {
  status: null,
  clientId: null,
  serviceId: null,
  from: '',
  to: '',
  balanceDue: false,
  page: 1,
};

describe('parseJobsFilters', () => {
  it('sin parámetros no hay filtros', () => {
    expect(parse('')).toEqual(NO_FILTERS);
  });

  it('lee estado, cliente, servicio, fechas, saldo y página', () => {
    expect(
      parse(
        'estado=COMPLETED&cliente=5&servicio=7&desde=2026-11-01&hasta=2026-11-30&saldo=1&pagina=3',
      ),
    ).toEqual({
      status: 'COMPLETED',
      clientId: 5,
      serviceId: 7,
      from: '2026-11-01',
      to: '2026-11-30',
      balanceDue: true,
      page: 3,
    });
  });

  it.each(['NOPE', 'completed', 'toString', 'constructor', '__proto__', ''])(
    'estado inválido (%j) se ignora',
    (status) => {
      expect(parse(`estado=${status}`).status).toBeNull();
    },
  );

  it.each(['abc', '0', '-3', '1.5', '01', '1234567890', ''])('id inválido (%j) se ignora', (id) => {
    const filters = parse(`cliente=${id}&servicio=${id}`);
    expect(filters.clientId).toBeNull();
    expect(filters.serviceId).toBeNull();
  });

  it.each(['0002-11-23', '1999-12-31', '2100-01-01', '2026-13-01', '2026-02-30', '2026-11', 'hoy'])(
    'fecha incompleta o fuera de rango (%j) se ignora',
    (date) => {
      const filters = parse(`desde=${date}&hasta=${date}`);
      expect(filters.from).toBe('');
      expect(filters.to).toBe('');
    },
  );

  it('"hasta" anterior a "desde" se descarta (y se conserva "desde")', () => {
    expect(parse('desde=2026-11-10&hasta=2026-11-01')).toMatchObject({
      from: '2026-11-10',
      to: '',
    });
  });

  it('"hasta" igual a "desde" se acepta', () => {
    expect(parse('desde=2026-11-10&hasta=2026-11-10')).toMatchObject({
      from: '2026-11-10',
      to: '2026-11-10',
    });
  });

  it('"hasta" solo, sin "desde", se conserva', () => {
    expect(parse('hasta=2026-11-01').to).toBe('2026-11-01');
  });

  it('saldo solo vale con "1"', () => {
    expect(parse('saldo=1').balanceDue).toBe(true);
    expect(parse('saldo=true').balanceDue).toBe(false);
    expect(parse('saldo=0').balanceDue).toBe(false);
  });

  it.each([
    ['2', 2],
    ['10000', 10000],
    ['10001', 1],
    ['0', 1],
    ['-1', 1],
    ['1.5', 1],
    ['abc', 1],
    ['', 1],
  ])('página %j -> %i', (page, expected) => {
    expect(parse(`pagina=${page}`).page).toBe(expected);
  });
});

describe('isCompleteFilterDate', () => {
  it('acepta fechas completas con año entre 2000 y 2099', () => {
    expect(isCompleteFilterDate('2026-11-23')).toBe(true);
    expect(isCompleteFilterDate('2000-01-01')).toBe(true);
    expect(isCompleteFilterDate('2099-12-31')).toBe(true);
  });

  it('rechaza años parciales y fuera de rango', () => {
    expect(isCompleteFilterDate('0002-11-23')).toBe(false);
    expect(isCompleteFilterDate('1999-12-31')).toBe(false);
    expect(isCompleteFilterDate('2100-01-01')).toBe(false);
    expect(isCompleteFilterDate('')).toBe(false);
  });
});

describe('isDateRangeInverted', () => {
  const inverted = (query: string) => isDateRangeInverted(new URLSearchParams(query));

  it('true si "hasta" es anterior a "desde"', () => {
    expect(inverted('desde=2026-11-10&hasta=2026-11-01')).toBe(true);
  });

  it('false con rango válido, igual o con una sola fecha', () => {
    expect(inverted('desde=2026-11-01&hasta=2026-11-10')).toBe(false);
    expect(inverted('desde=2026-11-10&hasta=2026-11-10')).toBe(false);
    expect(inverted('desde=2026-11-10')).toBe(false);
    expect(inverted('hasta=2026-11-10')).toBe(false);
    expect(inverted('')).toBe(false);
  });

  it('false si alguna fecha no es válida', () => {
    expect(inverted('desde=2026-11-10&hasta=abc')).toBe(false);
  });
});

describe('hasJobsFilters', () => {
  it('false sin filtros (la página no cuenta)', () => {
    expect(hasJobsFilters({ ...NO_FILTERS, page: 4 })).toBe(false);
  });

  it.each([
    { status: 'QUOTED' as const },
    { clientId: 1 },
    { serviceId: 1 },
    { from: '2026-11-01' },
    { to: '2026-11-01' },
    { balanceDue: true },
  ])('true con %j', (filter) => {
    expect(hasJobsFilters({ ...NO_FILTERS, ...filter })).toBe(true);
  });
});

describe('jobsApiQuery / jobsExportQuery', () => {
  it('sin filtros solo manda página y tamaño', () => {
    expect(jobsApiQuery(NO_FILTERS)).toBe(`page=1&pageSize=${JOBS_PAGE_SIZE}`);
  });

  it('omite los valores vacíos y manda los de los filtros con los nombres de la API', () => {
    const query = new URLSearchParams(
      jobsApiQuery({
        status: 'IN_PROGRESS',
        clientId: 5,
        serviceId: null,
        from: '2026-11-01',
        to: '',
        balanceDue: true,
        page: 2,
      }),
    );
    expect(Object.fromEntries(query)).toEqual({
      status: 'IN_PROGRESS',
      clientId: '5',
      from: '2026-11-01',
      balanceDue: 'true',
      page: '2',
      pageSize: String(JOBS_PAGE_SIZE),
    });
  });

  it('balanceDue en false no se manda', () => {
    expect(jobsApiQuery(NO_FILTERS)).not.toContain('balanceDue');
  });

  it('el pageSize se puede cambiar', () => {
    expect(jobsApiQuery(NO_FILTERS, 6)).toBe('page=1&pageSize=6');
  });

  it('la exportación lleva el formato y los filtros, sin página', () => {
    const query = new URLSearchParams(
      jobsExportQuery({ ...NO_FILTERS, status: 'COMPLETED', page: 3 }, 'csv'),
    );
    expect(Object.fromEntries(query)).toEqual({ status: 'COMPLETED', format: 'csv' });
  });
});

describe('parseClientsFilters / clientsApiQuery', () => {
  const parseClients = (query: string) => parseClientsFilters(new URLSearchParams(query));

  it('sin parámetros: búsqueda vacía y página 1', () => {
    expect(parseClients('')).toEqual({ q: '', page: 1 });
  });

  it('lee q y página', () => {
    expect(parseClients('q=ana&pagina=2')).toEqual({ q: 'ana', page: 2 });
  });

  it('recorta q al máximo permitido por la API', () => {
    expect(parseClients(`q=${'a'.repeat(300)}`).q).toHaveLength(100);
  });

  it('una página inválida vuelve a la 1', () => {
    expect(parseClients('pagina=0').page).toBe(1);
    expect(parseClients('pagina=x').page).toBe(1);
  });

  it('la consulta a la API recorta espacios y omite q vacía', () => {
    expect(clientsApiQuery({ q: '  ana  ', page: 2 })).toBe(
      `q=ana&page=2&pageSize=${CLIENTS_PAGE_SIZE}`,
    );
    expect(clientsApiQuery({ q: '   ', page: 1 })).toBe(`page=1&pageSize=${CLIENTS_PAGE_SIZE}`);
  });

  it('la exportación lleva q y formato, sin página', () => {
    expect(clientsExportQuery({ q: 'ana', page: 5 }, 'pdf')).toBe('q=ana&format=pdf');
    expect(clientsExportQuery({ q: '', page: 5 }, 'csv')).toBe('format=csv');
  });
});
