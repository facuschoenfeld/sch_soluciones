import type {
  AdminCategory,
  AdminClientDetail,
  AdminClientSummary,
  AdminDashboard,
  AdminJob,
  AdminServiceDetail,
  AdminServiceSummary,
} from '@sch/shared';

export function makeCategory(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: 1,
    name: 'Reparación',
    slug: 'reparacion',
    description: null,
    icon: null,
    line: 'TECH_SUPPORT',
    sortOrder: 0,
    isActive: true,
    servicesCount: 0,
    ...overrides,
  };
}

export function makeService(overrides: Partial<AdminServiceSummary> = {}): AdminServiceSummary {
  return {
    id: 1,
    categoryId: 1,
    name: 'Instalación de Windows',
    slug: 'instalacion-de-windows',
    shortDescription: 'Instalación limpia con drivers.',
    priceType: 'FIXED',
    priceAmount: 30000,
    currency: 'ARS',
    priceUnit: null,
    estimatedTime: null,
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
    priceUpdatedAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    category: { id: 1, name: 'Reparación', line: 'TECH_SUPPORT', isActive: true },
    jobsCount: 0,
    ...overrides,
  };
}

export function makeServiceDetail(overrides: Partial<AdminServiceDetail> = {}): AdminServiceDetail {
  return {
    ...makeService(),
    description: 'Detalle **completo**.',
    whatsappTemplate: null,
    ...overrides,
  };
}

/** Categorías de ejemplo: 1 con servicios (no se borra), 2 y 3 vacías. */
export const categoriesList: AdminCategory[] = [
  makeCategory({ id: 1, name: 'Reparación', slug: 'reparacion', sortOrder: 0, servicesCount: 2 }),
  makeCategory({
    id: 2,
    name: 'Desarrollo web',
    slug: 'desarrollo-web',
    line: 'DEVELOPMENT',
    sortOrder: 1,
    servicesCount: 0,
  }),
  makeCategory({
    id: 3,
    name: 'Redes',
    slug: 'redes',
    sortOrder: 2,
    servicesCount: 0,
    isActive: false,
  }),
];

export function makeClient(overrides: Partial<AdminClientSummary> = {}): AdminClientSummary {
  return {
    id: 1,
    fullName: 'Ana Pérez',
    phone: '5491122334455',
    email: 'ana@example.com',
    source: 'WHATSAPP',
    createdAt: '2026-11-01T15:00:00.000Z',
    jobsCount: 0,
    ...overrides,
  };
}

export function makeClientDetail(overrides: Partial<AdminClientDetail> = {}): AdminClientDetail {
  return {
    ...makeClient(),
    address: 'Calle 123',
    notes: 'Prefiere la mañana.',
    updatedAt: '2026-11-01T15:00:00.000Z',
    totals: [],
    ...overrides,
  };
}

export function makeJob(overrides: Partial<AdminJob> = {}): AdminJob {
  return {
    id: 1,
    clientId: 1,
    client: { id: 1, fullName: 'Ana Pérez', phone: '5491122334455' },
    serviceId: null,
    service: null,
    serviceNameSnapshot: null,
    servicePriceSnapshot: null,
    servicePriceTypeSnapshot: null,
    serviceCurrencySnapshot: null,
    title: 'Reparar notebook',
    description: null,
    deviceInfo: null,
    status: 'QUOTED',
    amountCharged: 10000,
    currency: 'ARS',
    amountPaid: 0,
    receivedAt: '2026-11-20T15:00:00.000Z',
    scheduledAt: null,
    completedAt: null,
    internalNotes: null,
    createdAt: '2026-11-20T15:00:00.000Z',
    updatedAt: '2026-11-20T15:00:00.000Z',
    ...overrides,
  };
}

export function makeDashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    month: { start: '2026-11-01T03:00:00.000Z', end: '2026-12-01T03:00:00.000Z' },
    statusCounts: {
      QUOTED: 0,
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    },
    monthIncome: [],
    balanceDue: { jobs: 0, byCurrency: [] },
    upcomingJobs: [],
    recentClients: [],
    ...overrides,
  };
}

/** Respuesta paginada de la API (`{ data, meta }`). */
export function paginated<T>(data: T[], { page = 1, pageSize = 20, total = data.length } = {}) {
  return { data, meta: { page, pageSize, total } };
}
