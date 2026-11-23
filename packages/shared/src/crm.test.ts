import { describe, expect, it } from 'vitest';
import {
  JOB_STATUS_FLOW,
  balanceDue,
  businessDayRange,
  businessMonthRange,
  dateInputToIso,
  dateTimeInputToIso,
  formatDate,
  formatDateTime,
  isBackwardStatusChange,
  isDoneJobStatus,
  isoToDateInput,
  isoToDateTimeInput,
  isValidDateInput,
  isValidDateTimeInput,
  jobStatusChangeIssue,
  nextJobStatus,
  paymentStatus,
  todayDateInput,
} from './crm.js';

describe('nextJobStatus', () => {
  it('recorre el flujo normal', () => {
    expect(nextJobStatus('QUOTED')).toBe('SCHEDULED');
    expect(nextJobStatus('SCHEDULED')).toBe('IN_PROGRESS');
    expect(nextJobStatus('IN_PROGRESS')).toBe('COMPLETED');
    expect(nextJobStatus('COMPLETED')).toBe('DELIVERED');
  });

  it('no hay paso siguiente tras entregar ni cancelar', () => {
    expect(nextJobStatus('DELIVERED')).toBeNull();
    expect(nextJobStatus('CANCELLED')).toBeNull();
  });
});

describe('isBackwardStatusChange', () => {
  it('retroceder en el flujo es true', () => {
    expect(isBackwardStatusChange('COMPLETED', 'IN_PROGRESS')).toBe(true);
    expect(isBackwardStatusChange('DELIVERED', 'QUOTED')).toBe(true);
  });

  it('reabrir un cancelado es retroceder', () => {
    for (const to of JOB_STATUS_FLOW) expect(isBackwardStatusChange('CANCELLED', to)).toBe(true);
  });

  it('avanzar (aunque se salteen pasos), cancelar o no cambiar no lo es', () => {
    expect(isBackwardStatusChange('QUOTED', 'COMPLETED')).toBe(false);
    expect(isBackwardStatusChange('IN_PROGRESS', 'CANCELLED')).toBe(false);
    expect(isBackwardStatusChange('SCHEDULED', 'SCHEDULED')).toBe(false);
    expect(isBackwardStatusChange('CANCELLED', 'CANCELLED')).toBe(false);
  });
});

describe('jobStatusChangeIssue', () => {
  it('solo impide cancelar un entregado', () => {
    expect(jobStatusChangeIssue('DELIVERED', 'CANCELLED')).toMatch(/entregado/);
    expect(jobStatusChangeIssue('COMPLETED', 'CANCELLED')).toBeNull();
    expect(jobStatusChangeIssue('DELIVERED', 'IN_PROGRESS')).toBeNull();
    expect(jobStatusChangeIssue('CANCELLED', 'QUOTED')).toBeNull();
  });
});

describe('isDoneJobStatus', () => {
  it('terminados y entregados', () => {
    expect(isDoneJobStatus('COMPLETED')).toBe(true);
    expect(isDoneJobStatus('DELIVERED')).toBe(true);
    expect(isDoneJobStatus('IN_PROGRESS')).toBe(false);
    expect(isDoneJobStatus('CANCELLED')).toBe(false);
  });
});

describe('paymentStatus y balanceDue', () => {
  it('clasifica el estado de pago', () => {
    expect(paymentStatus(0, 0)).toBe('NO_CHARGE');
    expect(paymentStatus(1000, 0)).toBe('PENDING');
    expect(paymentStatus(1000, 400)).toBe('PARTIAL');
    expect(paymentStatus(1000, 1000)).toBe('PAID');
  });

  it('compara en centavos (sin errores de punto flotante)', () => {
    expect(paymentStatus(0.3, 0.1 + 0.2)).toBe('PAID');
    expect(balanceDue(0.3, 0.1 + 0.2)).toBe(0);
    expect(balanceDue(100.1, 0.2)).toBe(99.9);
  });

  it('el saldo nunca es negativo', () => {
    expect(balanceDue(1000, 400)).toBe(600);
    expect(balanceDue(1000, 1500)).toBe(0);
    expect(paymentStatus(1000, 1500)).toBe('PAID');
  });
});

describe('fechas en hora argentina', () => {
  it('dateInputToIso / dateTimeInputToIso suman 3 h', () => {
    expect(dateInputToIso('2026-11-23')).toBe('2026-11-23T03:00:00.000Z');
    expect(dateTimeInputToIso('2026-11-23T15:30')).toBe('2026-11-23T18:30:00.000Z');
    expect(dateTimeInputToIso('2026-11-23T22:00')).toBe('2026-11-24T01:00:00.000Z');
  });

  it('isoToDateInput / isoToDateTimeInput restan 3 h (cruzan el día)', () => {
    expect(isoToDateInput('2026-11-23T18:30:00.000Z')).toBe('2026-11-23');
    expect(isoToDateInput('2026-11-24T02:59:59.999Z')).toBe('2026-11-23');
    expect(isoToDateInput('2026-11-24T03:00:00.000Z')).toBe('2026-11-24');
    expect(isoToDateTimeInput('2026-11-23T18:30:00.000Z')).toBe('2026-11-23T15:30');
    expect(isoToDateTimeInput('2026-01-01T01:00:00.000Z')).toBe('2025-12-31T22:00');
  });

  it('son inversas entre sí', () => {
    const local = '2026-02-28T23:45';
    expect(isoToDateTimeInput(dateTimeInputToIso(local))).toBe(local);
  });

  it('todayDateInput usa el día argentino', () => {
    expect(todayDateInput(new Date('2026-11-24T01:00:00.000Z'))).toBe('2026-11-23');
  });

  it('isValidDateInput rechaza fechas imposibles y formatos raros', () => {
    expect(isValidDateInput('2026-11-23')).toBe(true);
    expect(isValidDateInput('2028-02-29')).toBe(true);
    expect(isValidDateInput('2026-02-29')).toBe(false);
    expect(isValidDateInput('2026-02-31')).toBe(false);
    expect(isValidDateInput('2026-13-01')).toBe(false);
    expect(isValidDateInput('2026-00-10')).toBe(false);
    expect(isValidDateInput('2026-1-1')).toBe(false);
    expect(isValidDateInput('')).toBe(false);
    expect(isValidDateInput('2026-11-23T10:00')).toBe(false);
  });

  it('isValidDateTimeInput valida hora y minutos', () => {
    expect(isValidDateTimeInput('2026-11-23T23:59')).toBe(true);
    expect(isValidDateTimeInput('2026-11-23T24:00')).toBe(false);
    expect(isValidDateTimeInput('2026-11-23T10:60')).toBe(false);
    expect(isValidDateTimeInput('2026-02-31T10:00')).toBe(false);
    expect(isValidDateTimeInput('2026-11-23')).toBe(false);
  });

  it('businessDayRange cubre días completos, ambos inclusive', () => {
    const { start, end } = businessDayRange('2026-11-23', '2026-11-25');
    expect(start.toISOString()).toBe('2026-11-23T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-26T03:00:00.000Z');
    const single = businessDayRange('2026-11-23', '2026-11-23');
    expect(single.end.getTime() - single.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('businessMonthRange: mes en curso en hora argentina', () => {
    const { start, end } = businessMonthRange(new Date('2026-11-15T12:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });

  it('businessMonthRange: fin de mes a las 22:00 AR (ya es el mes siguiente en UTC)', () => {
    // 30/11 22:00 AR = 01/12 01:00 UTC: sigue siendo noviembre en Argentina.
    const { start, end } = businessMonthRange(new Date('2026-12-01T01:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });

  it('businessMonthRange: el límite exacto pertenece al mes nuevo, y diciembre pasa de año', () => {
    const edge = businessMonthRange(new Date('2026-12-01T03:00:00.000Z'));
    expect(edge.start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(edge.end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
    // 01/01 01:00 UTC todavía es 31/12 en Argentina.
    const newYear = businessMonthRange(new Date('2027-01-01T01:00:00.000Z'));
    expect(newYear.start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });

  it('formatDate / formatDateTime usan hora argentina', () => {
    expect(formatDate('2026-11-24T01:00:00.000Z')).toBe('23/11/2026');
    expect(formatDateTime('2026-11-23T18:30:00.000Z')).toContain('15:30');
    expect(formatDateTime('2026-11-23T18:30:00.000Z')).toContain('23/11/2026');
  });
});
