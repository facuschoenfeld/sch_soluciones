import type { AdminCategory, AdminServiceDetail, AdminServiceSummary } from '@sch/shared';

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
