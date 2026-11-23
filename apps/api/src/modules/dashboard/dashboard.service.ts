import {
  DONE_JOB_STATUSES,
  OPEN_JOB_STATUSES,
  businessMonthRange,
  jobStatusSchema,
  type AdminDashboard,
  type JobStatus,
} from '@sch/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { balanceDueWhere } from '../jobs/jobs.service.js';

const UPCOMING_LIMIT = 5;
const RECENT_CLIENTS_LIMIT = 5;

/**
 * Métricas del inicio del panel. Los montos se agrupan por moneda (no se suman pesos con
 * dólares). Ingresos del mes = trabajos terminados o entregados con fecha de terminado en el
 * mes en curso (hora argentina): lo facturado y cuánto de eso ya se cobró.
 */
export async function getDashboard(prisma: PrismaClient, now: Date): Promise<AdminDashboard> {
  const month = businessMonthRange(now);
  const [statusGroups, incomeGroups, balanceGroups, upcoming, recentClients] = await Promise.all([
    prisma.job.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    prisma.job.groupBy({
      by: ['currency'],
      where: {
        status: { in: [...DONE_JOB_STATUSES] },
        completedAt: { gte: month.start, lt: month.end },
      },
      _sum: { amountCharged: true, amountPaid: true },
      _count: { _all: true },
      orderBy: { currency: 'asc' },
    }),
    prisma.job.groupBy({
      by: ['currency'],
      where: balanceDueWhere(prisma),
      _sum: { amountCharged: true, amountPaid: true },
      _count: { _all: true },
      orderBy: { currency: 'asc' },
    }),
    prisma.job.findMany({
      where: { status: { in: [...OPEN_JOB_STATUSES] }, scheduledAt: { gte: now } },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: UPCOMING_LIMIT,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        client: { select: { id: true, fullName: true } },
      },
    }),
    prisma.client.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_CLIENTS_LIMIT,
      select: { id: true, fullName: true, createdAt: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    jobStatusSchema.options.map((status) => [status, 0]),
  ) as Record<JobStatus, number>;
  for (const group of statusGroups) statusCounts[group.status] = group._count._all;

  return {
    month: { start: month.start.toISOString(), end: month.end.toISOString() },
    statusCounts,
    monthIncome: incomeGroups.map(({ currency, _sum, _count }) => ({
      currency,
      charged: _sum.amountCharged?.toNumber() ?? 0,
      paid: _sum.amountPaid?.toNumber() ?? 0,
      jobs: _count._all,
    })),
    balanceDue: {
      jobs: balanceGroups.reduce((sum, group) => sum + group._count._all, 0),
      byCurrency: balanceGroups.map(({ currency, _sum }) => ({
        currency,
        // Resta en Decimal (sin errores de punto flotante).
        amount:
          _sum.amountCharged && _sum.amountPaid
            ? _sum.amountCharged.minus(_sum.amountPaid).toNumber()
            : 0,
      })),
    },
    upcomingJobs: upcoming.flatMap(({ scheduledAt, ...job }) =>
      scheduledAt ? [{ ...job, scheduledAt: scheduledAt.toISOString() }] : [],
    ),
    recentClients: recentClients.map(({ createdAt, ...client }) => ({
      ...client,
      createdAt: createdAt.toISOString(),
    })),
  };
}
