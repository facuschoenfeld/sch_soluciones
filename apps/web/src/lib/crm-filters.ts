import {
  JOB_STATUS_LABELS,
  PAGE_MAX,
  SEARCH_QUERY_MAX_LENGTH,
  isValidDateInput,
  type ExportFormat,
  type JobStatus,
} from '@sch/shared';

// Filtros de los listados de clientes y trabajos. Viven en la URL (en español) y se normalizan
// con los límites de @sch/shared: el front nunca pide algo que la API rechace con 400.

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= PAGE_MAX ? page : 1;
}

function parseId(value: string | null): number | null {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

function isJobStatus(value: string | null): value is JobStatus {
  // Propiedad propia: "toString" o "constructor" también están "in" el objeto (prototipo).
  return value !== null && Object.prototype.hasOwnProperty.call(JOB_STATUS_LABELS, value);
}

/** Query string para la API, sin los valores vacíos. */
function toQuery(entries: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

// --- Clientes --------------------------------------------------------------

export const CLIENTS_PAGE_SIZE = 20;

export interface ClientsUrlFilters {
  q: string;
  page: number;
}

/** `?q=&pagina=`. */
export function parseClientsFilters(params: URLSearchParams): ClientsUrlFilters {
  return {
    q: (params.get('q') ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH),
    page: parsePage(params.get('pagina')),
  };
}

export function clientsApiQuery({ q, page }: ClientsUrlFilters): string {
  return toQuery({ q: q.trim(), page, pageSize: CLIENTS_PAGE_SIZE });
}

export function clientsExportQuery({ q }: ClientsUrlFilters, format: ExportFormat): string {
  return toQuery({ q: q.trim(), format });
}

// --- Trabajos --------------------------------------------------------------

export const JOBS_PAGE_SIZE = 20;

export interface JobsUrlFilters {
  status: JobStatus | null;
  clientId: number | null;
  serviceId: number | null;
  /** Fecha de ingreso desde / hasta ("2026-11-23"). */
  from: string;
  to: string;
  balanceDue: boolean;
  page: number;
}

/** `?estado=&cliente=&servicio=&desde=&hasta=&saldo=1&pagina=`. */
export function parseJobsFilters(params: URLSearchParams): JobsUrlFilters {
  const status = params.get('estado');
  const rawFrom = params.get('desde') ?? '';
  const rawTo = params.get('hasta') ?? '';
  const from = isCompleteFilterDate(rawFrom) ? rawFrom : '';
  const to = isCompleteFilterDate(rawTo) ? rawTo : '';
  return {
    status: isJobStatus(status) ? status : null,
    clientId: parseId(params.get('cliente')),
    serviceId: parseId(params.get('servicio')),
    from,
    // "Hasta" anterior a "desde" la API la rechaza: se ignora.
    to: from && to && to < from ? '' : to,
    balanceDue: params.get('saldo') === '1',
    page: parsePage(params.get('pagina')),
  };
}

/** Parámetros de la URL para un filtro (para links, ej. desde el inicio o la ficha). */
export const JOBS_URL_PARAMS = {
  status: 'estado',
  clientId: 'cliente',
  serviceId: 'servicio',
  from: 'desde',
  to: 'hasta',
  balanceDue: 'saldo',
  page: 'pagina',
} as const satisfies Record<keyof JobsUrlFilters, string>;

export function hasJobsFilters(filters: JobsUrlFilters): boolean {
  return Boolean(
    filters.status ||
    filters.clientId ||
    filters.serviceId ||
    filters.from ||
    filters.to ||
    filters.balanceDue,
  );
}

function jobsFilterQuery(filters: JobsUrlFilters) {
  return {
    status: filters.status,
    clientId: filters.clientId,
    serviceId: filters.serviceId,
    from: filters.from,
    to: filters.to,
    balanceDue: filters.balanceDue,
  };
}

export function jobsApiQuery(filters: JobsUrlFilters, pageSize = JOBS_PAGE_SIZE): string {
  return toQuery({ ...jobsFilterQuery(filters), page: filters.page, pageSize });
}

export function jobsExportQuery(filters: JobsUrlFilters, format: ExportFormat): string {
  return toQuery({ ...jobsFilterQuery(filters), format });
}

/**
 * Fecha completa para aplicar como filtro. Mientras se tipea el año, el input de fecha emite
 * valores como "0002-11-23": se esperan los 4 dígitos (y un año razonable) antes de buscar.
 */
export function isCompleteFilterDate(value: string): boolean {
  if (!isValidDateInput(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year < 2100;
}

/** "Hasta" anterior a "desde" en la URL (se ignora al buscar; el panel lo avisa). */
export function isDateRangeInverted(params: URLSearchParams): boolean {
  const from = params.get('desde') ?? '';
  const to = params.get('hasta') ?? '';
  return isValidDateInput(from) && isValidDateInput(to) && to < from;
}
