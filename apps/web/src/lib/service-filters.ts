import type { PublicCategory, PublicServiceSummary, ServiceLine } from '@sch/shared';

// Filtros del listado de servicios. Viven en la URL (?linea=&categoria=&q=) para que se puedan
// compartir y para que las tarjetas del inicio enlacen directo a una línea.

export const LINE_PARAMS = {
  desarrollo: 'DEVELOPMENT',
  'servicio-tecnico': 'TECH_SUPPORT',
} as const satisfies Record<string, ServiceLine>;

export type LineParam = keyof typeof LINE_PARAMS;

export const LINE_LABELS: Record<ServiceLine, string> = {
  DEVELOPMENT: 'Desarrollo',
  TECH_SUPPORT: 'Servicio técnico',
};

export function lineParamFor(line: ServiceLine): LineParam {
  return line === 'DEVELOPMENT' ? 'desarrollo' : 'servicio-tecnico';
}

/** Línea a partir del parámetro de la URL; un valor desconocido equivale a "todas". */
export function parseLineParam(value: string | null): ServiceLine | null {
  if (value && Object.hasOwn(LINE_PARAMS, value)) {
    return LINE_PARAMS[value as LineParam];
  }
  return null;
}

export function filterCategoriesByLine(
  categories: PublicCategory[],
  line: ServiceLine | null,
): PublicCategory[] {
  return line ? categories.filter((category) => category.line === line) : categories;
}

export function filterServicesByLine(
  services: PublicServiceSummary[],
  line: ServiceLine | null,
): PublicServiceSummary[] {
  return line ? services.filter((service) => service.category.line === line) : services;
}
