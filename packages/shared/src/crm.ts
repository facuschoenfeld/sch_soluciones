import type { ClientSource, Currency, JobStatus } from './enums.js';

// Clientes y trabajos: etiquetas, flujo de estados, estado de pago y fechas en hora argentina.
// Sin Zod: lo usan el panel, la API y la exportación a PDF.

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'Recomendación',
  WEB: 'Sitio web',
  OTHER: 'Otro',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  QUOTED: 'Presupuestado',
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Terminado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

/** Flujo normal de un trabajo (Cancelado queda aparte). */
export const JOB_STATUS_FLOW = [
  'QUOTED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'DELIVERED',
] as const satisfies readonly JobStatus[];

/** Trabajos terminados: cuentan como ingreso del mes (por `completedAt`) y pueden tener saldo. */
export const DONE_JOB_STATUSES = ['COMPLETED', 'DELIVERED'] as const satisfies readonly JobStatus[];

/** Trabajos abiertos: los que pueden tener un turno próximo. */
export const OPEN_JOB_STATUSES = [
  'QUOTED',
  'SCHEDULED',
  'IN_PROGRESS',
] as const satisfies readonly JobStatus[];

export function isDoneJobStatus(status: JobStatus): boolean {
  return (DONE_JOB_STATUSES as readonly JobStatus[]).includes(status);
}

function flowIndex(status: JobStatus): number {
  return (JOB_STATUS_FLOW as readonly JobStatus[]).indexOf(status);
}

/** Paso siguiente del flujo (null si ya está entregado o cancelado). */
export function nextJobStatus(status: JobStatus): JobStatus | null {
  if (status === 'CANCELLED') return null;
  return JOB_STATUS_FLOW[flowIndex(status) + 1] ?? null;
}

/**
 * Retroceder en el flujo (ej. Terminado → En curso) o reabrir un cancelado. Se permite, pero el
 * panel pide confirmación. Avanzar (aunque se salteen pasos) y cancelar no la piden.
 */
export function isBackwardStatusChange(from: JobStatus, to: JobStatus): boolean {
  if (from === to || to === 'CANCELLED') return false;
  if (from === 'CANCELLED') return true;
  return flowIndex(to) < flowIndex(from);
}

/** Cambio de estado no permitido (la API responde 409). Null si se puede. */
export function jobStatusChangeIssue(from: JobStatus, to: JobStatus): string | null {
  if (from === 'DELIVERED' && to === 'CANCELLED') {
    return 'Un trabajo entregado no se puede cancelar';
  }
  return null;
}

export type PaymentStatus = 'NO_CHARGE' | 'PENDING' | 'PARTIAL' | 'PAID';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  NO_CHARGE: 'Sin cargo',
  PENDING: 'Sin pagar',
  PARTIAL: 'Pago parcial',
  PAID: 'Pagado',
};

const toCents = (amount: number) => Math.round(amount * 100);

/** Pagado / parcial / sin pagar, comparando en centavos (sin errores de punto flotante). */
export function paymentStatus(amountCharged: number, amountPaid: number): PaymentStatus {
  const charged = toCents(amountCharged);
  const paid = toCents(amountPaid);
  if (charged === 0) return 'NO_CHARGE';
  if (paid >= charged) return 'PAID';
  return paid > 0 ? 'PARTIAL' : 'PENDING';
}

/** Saldo a cobrar (nunca negativo), redondeado a centavos. */
export function balanceDue(amountCharged: number, amountPaid: number): number {
  return Math.max(0, toCents(amountCharged) - toCents(amountPaid)) / 100;
}

/** Totales por moneda (no se suman pesos con dólares). */
export interface CurrencyTotals {
  currency: Currency;
  charged: number;
  paid: number;
}

// --- Fechas ----------------------------------------------------------------
// El negocio trabaja en hora argentina (UTC-3 todo el año, sin horario de verano desde 2009).
// Las fechas viajan como ISO (UTC); los inputs del panel y los filtros usan hora argentina,
// independientemente de la zona horaria del navegador o del servidor.

export const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const BUSINESS_UTC_OFFSET = '-03:00';
const BUSINESS_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-11-23" válido (rechaza fechas imposibles como el 31 de febrero). */
export function isValidDateInput(value: string): boolean {
  const match = DATE_INPUT_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** "2026-11-23T15:30" válido. */
export function isValidDateTimeInput(value: string): boolean {
  const match = DATE_TIME_INPUT_PATTERN.exec(value);
  if (!match) return false;
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  return isValidDateInput(value.slice(0, 10)) && hours < 24 && minutes < 60;
}

/** Inicio del día en Argentina: "2026-11-23" → "2026-11-23T03:00:00.000Z". */
export function dateInputToIso(value: string): string {
  return new Date(`${value}T00:00:00.000${BUSINESS_UTC_OFFSET}`).toISOString();
}

/** Hora argentina: "2026-11-23T15:30" → "2026-11-23T18:30:00.000Z". */
export function dateTimeInputToIso(value: string): string {
  return new Date(`${value}:00.000${BUSINESS_UTC_OFFSET}`).toISOString();
}

function shiftToBusinessTime(iso: string): string {
  return new Date(Date.parse(iso) + BUSINESS_OFFSET_MS).toISOString();
}

/** Para `<input type="date">`: el día en Argentina. */
export function isoToDateInput(iso: string): string {
  return shiftToBusinessTime(iso).slice(0, 10);
}

/** Para `<input type="datetime-local">`: fecha y hora en Argentina. */
export function isoToDateTimeInput(iso: string): string {
  return shiftToBusinessTime(iso).slice(0, 16);
}

/** Hoy en Argentina ("2026-11-23"). */
export function todayDateInput(now: Date = new Date()): string {
  return isoToDateInput(now.toISOString());
}

/** Rango [desde, hasta) que cubre días completos en Argentina, ambos inclusive. */
export function businessDayRange(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(dateInputToIso(from)),
    end: new Date(Date.parse(dateInputToIso(to)) + DAY_MS),
  };
}

/** Mes en curso en Argentina, como rango [inicio, inicio del mes siguiente). */
export function businessMonthRange(now: Date): { start: Date; end: Date } {
  const local = new Date(now.getTime() + BUSINESS_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - BUSINESS_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - BUSINESS_OFFSET_MS),
  };
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const monthFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: BUSINESS_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

/** "23/11/2026" (hora argentina). */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** "23/11/2026, 15:30" (hora argentina). */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** "noviembre de 2026". */
export function formatMonth(date: Date): string {
  return monthFormatter.format(date);
}
