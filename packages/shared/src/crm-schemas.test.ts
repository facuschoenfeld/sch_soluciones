import { describe, expect, it } from 'vitest';
import { PAGE_MAX, PAGE_SIZE_MAX } from './constraints.js';
import {
  clientInputSchema,
  clientUpdateSchema,
  clientsQuerySchema,
  deviceInfoSchema,
  jobInputSchema,
  jobUpdateSchema,
  jobsFilterSchema,
  jobsQuerySchema,
  paginationQuerySchema,
  phoneSchema,
} from './schemas.js';

describe('phoneSchema', () => {
  it('normaliza a dígitos', () => {
    expect(phoneSchema.parse('+54 (11) 2233-4455')).toBe('541122334455');
    expect(phoneSchema.parse('11.2233.4455')).toBe('1122334455');
  });

  it.each(['', '   ', '12345', '1'.repeat(16), 'abc12345678', '11 2233 44x5'])(
    'rechaza %j',
    (value) => {
      expect(phoneSchema.safeParse(value).success).toBe(false);
    },
  );

  it('acepta los límites de 6 y 15 dígitos', () => {
    expect(phoneSchema.safeParse('123456').success).toBe(true);
    expect(phoneSchema.safeParse('1'.repeat(15)).success).toBe(true);
  });
});

describe('clientInputSchema', () => {
  const valid = {
    fullName: ' Ana Pérez ',
    phone: '11 2233-4455',
    email: '',
    address: '  ',
    source: 'WHATSAPP',
    notes: null,
  };

  it('caso feliz: recorta, normaliza y vacíos pasan a null', () => {
    expect(clientInputSchema.parse(valid)).toEqual({
      fullName: 'Ana Pérez',
      phone: '1122334455',
      email: null,
      address: null,
      source: 'WHATSAPP',
      notes: null,
    });
  });

  it('email se pasa a minúsculas', () => {
    expect(clientInputSchema.parse({ ...valid, email: 'ANA@Mail.com' }).email).toBe('ana@mail.com');
  });

  it('rechaza nombre vacío, email inválido y origen desconocido', () => {
    expect(clientInputSchema.safeParse({ ...valid, fullName: '  ' }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...valid, email: 'no-es-email' }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...valid, source: 'RADIO' }).success).toBe(false);
  });

  it('el PATCH acepta un subconjunto', () => {
    expect(clientUpdateSchema.parse({ phone: '(11) 5555-6666' })).toEqual({ phone: '1155556666' });
    expect(clientUpdateSchema.parse({})).toEqual({});
  });
});

describe('deviceInfoSchema', () => {
  it('todo vacío o null -> null', () => {
    expect(deviceInfoSchema.parse(null)).toBeNull();
    expect(
      deviceInfoSchema.parse({ brand: ' ', model: '', serialNumber: null, reportedIssue: '  ' }),
    ).toBeNull();
  });

  it('con algún dato se conserva (vacíos como null)', () => {
    expect(
      deviceInfoSchema.parse({
        brand: 'HP',
        model: '',
        serialNumber: null,
        reportedIssue: 'No enciende',
      }),
    ).toEqual({ brand: 'HP', model: null, serialNumber: null, reportedIssue: 'No enciende' });
  });
});

describe('jobInputSchema', () => {
  const valid = {
    clientId: 1,
    serviceId: null,
    title: ' Reparar notebook ',
    description: null,
    deviceInfo: null,
    status: 'QUOTED',
    amountCharged: 10000,
    currency: 'ARS',
    amountPaid: 2500.5,
    receivedAt: '2026-11-23T18:30:00.000Z',
    scheduledAt: null,
    completedAt: null,
    internalNotes: null,
  };

  it('caso feliz: convierte fechas a Date y recorta el título', () => {
    const parsed = jobInputSchema.parse(valid);
    expect(parsed.title).toBe('Reparar notebook');
    expect(parsed.receivedAt).toBeInstanceOf(Date);
    expect(parsed.scheduledAt).toBeNull();
  });

  it('amountPaid > amountCharged se rechaza en amountPaid', () => {
    const result = jobInputSchema.safeParse({ ...valid, amountPaid: 10000.01 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['amountPaid']);
  });

  it('pagado igual al total es válido', () => {
    expect(jobInputSchema.safeParse({ ...valid, amountPaid: 10000 }).success).toBe(true);
  });

  it('rechaza montos negativos, con 3 decimales o enormes', () => {
    expect(jobInputSchema.safeParse({ ...valid, amountCharged: -1 }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...valid, amountCharged: 10.123 }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...valid, amountCharged: 1e15, amountPaid: 0 }).success).toBe(
      false,
    );
  });

  it('rechaza fechas inválidas, sin zona o fuera de 2000-2100', () => {
    const withReceived = (receivedAt: string) => jobInputSchema.safeParse({ ...valid, receivedAt });
    expect(withReceived('ayer').success).toBe(false);
    expect(withReceived('2026-11-23T10:00:00').success).toBe(false);
    expect(withReceived('1999-12-31T23:59:59.000Z').success).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...valid, scheduledAt: '2100-01-01T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('rechaza estado, moneda, cliente o título inválidos', () => {
    expect(jobInputSchema.safeParse({ ...valid, status: 'X' }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...valid, currency: 'EUR' }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...valid, clientId: 0 }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
  });

  it('el PATCH acepta un subconjunto y no cruza montos (lo valida la API)', () => {
    expect(jobUpdateSchema.parse({})).toEqual({});
    expect(jobUpdateSchema.safeParse({ amountPaid: 99999 }).success).toBe(true);
  });
});

describe('jobsQuerySchema / jobsFilterSchema', () => {
  it('sin filtros: defaults de paginación y balanceDue false', () => {
    expect(jobsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, balanceDue: false });
  });

  it('parsea strings de la query', () => {
    const parsed = jobsQuerySchema.parse({
      status: 'IN_PROGRESS',
      clientId: '3',
      serviceId: '4',
      from: '2026-11-01',
      to: '2026-11-30',
      balanceDue: 'true',
      page: '2',
      pageSize: '50',
    });
    expect(parsed).toMatchObject({
      status: 'IN_PROGRESS',
      clientId: 3,
      serviceId: 4,
      balanceDue: true,
      page: 2,
      pageSize: 50,
    });
  });

  it('valores vacíos equivalen a ausentes', () => {
    expect(jobsFilterSchema.parse({ status: '', clientId: '', from: '', balanceDue: '' })).toEqual({
      balanceDue: false,
    });
  });

  it('balanceDue acepta "false" y rechaza otros valores', () => {
    expect(jobsFilterSchema.parse({ balanceDue: 'false' }).balanceDue).toBe(false);
    expect(jobsFilterSchema.safeParse({ balanceDue: 'yes' }).success).toBe(false);
  });

  it('from > to se rechaza en "to"; from = to se acepta', () => {
    const bad = jobsQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-09' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(['to']);
    expect(jobsFilterSchema.safeParse({ from: '2026-11-10', to: '2026-11-09' }).success).toBe(
      false,
    );
    expect(jobsFilterSchema.safeParse({ from: '2026-11-10', to: '2026-11-10' }).success).toBe(true);
  });

  it('rechaza fechas imposibles, estados y ids inválidos', () => {
    expect(jobsFilterSchema.safeParse({ from: '2026-02-31' }).success).toBe(false);
    expect(jobsFilterSchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(jobsFilterSchema.safeParse({ clientId: '-1' }).success).toBe(false);
    expect(jobsFilterSchema.safeParse({ clientId: 'abc' }).success).toBe(false);
  });
});

describe('paginationQuerySchema', () => {
  it('defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '', pageSize: '' })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('límites', () => {
    const parse = (query: Record<string, string>) => paginationQuerySchema.safeParse(query).success;
    expect(parse({ page: '0' })).toBe(false);
    expect(parse({ page: String(PAGE_MAX + 1) })).toBe(false);
    expect(parse({ pageSize: '0' })).toBe(false);
    expect(parse({ pageSize: String(PAGE_SIZE_MAX + 1) })).toBe(false);
    expect(parse({ pageSize: String(PAGE_SIZE_MAX) })).toBe(true);
    expect(parse({ page: '1.5' })).toBe(false);
  });
});

describe('clientsQuerySchema', () => {
  it('q recortado; vacío o solo espacios = ausente; tope de largo', () => {
    expect(clientsQuerySchema.parse({ q: '  ana ' }).q).toBe('ana');
    expect(clientsQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
    expect(clientsQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });
});
