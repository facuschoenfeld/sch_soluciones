import {
  CLIENT_SOURCE_LABELS,
  DONE_JOB_STATUSES,
  formatDate,
  formatDateTime,
  type AdminClientDetail,
  type AdminClientSummary,
  type ClientInputParsed,
  type ClientUpdateParsed,
  type ClientsFilter,
  type ClientsQuery,
  type CurrencyTotals,
  type ExportFormat,
  type Paginated,
} from '@sch/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { isRecordNotFound } from '../../lib/admin-errors.js';
import { AppError } from '../../lib/app-error.js';
import { assertExportSize, csvDigits, exportRowLimit, toCsv } from '../../lib/export.js';
import { pageArgs, paginated } from '../../lib/pagination.js';
import { renderTablePdf } from '../../lib/pdf-table.js';
import { escapeLikePattern } from '../services/services.service.js';

// Clientes del mini CRM. Datos personales (Ley 25.326): solo se exponen en /api/admin y nunca
// se interpolan en mensajes de error ni en logs.

const clientSummarySelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  source: true,
  createdAt: true,
  _count: { select: { jobs: true } },
} satisfies Prisma.ClientSelect;

const clientDetailSelect = {
  ...clientSummarySelect,
  address: true,
  notes: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

type ClientSummaryRow = Prisma.ClientGetPayload<{ select: typeof clientSummarySelect }>;
type ClientDetailRow = Prisma.ClientGetPayload<{ select: typeof clientDetailSelect }>;

function toClientSummary({ _count, createdAt, ...row }: ClientSummaryRow): AdminClientSummary {
  return { ...row, createdAt: createdAt.toISOString(), jobsCount: _count.jobs };
}

export function clientNotFound(): AppError {
  return new AppError(404, 'CLIENT_NOT_FOUND', 'El cliente no existe');
}

/**
 * Búsqueda por nombre o email (contiene, sin distinguir mayúsculas) y por teléfono (los dígitos
 * de la búsqueda, así "11 2233" encuentra "541122334455").
 */
function clientsWhere({ q }: ClientsFilter): Prisma.ClientWhereInput {
  if (!q) return {};
  const search = escapeLikePattern(q);
  const digits = q.replace(/\D/g, '');
  return {
    OR: [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

const clientsOrderBy = [
  { fullName: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ClientOrderByWithRelationInput[];

export async function listClients(
  prisma: PrismaClient,
  query: ClientsQuery,
): Promise<Paginated<AdminClientSummary>> {
  const where = clientsWhere(query);
  const [total, rows] = await prisma.$transaction([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: clientsOrderBy,
      select: clientSummarySelect,
      ...pageArgs(query),
    }),
  ]);
  return paginated(rows.map(toClientSummary), query, total);
}

/**
 * Facturado y cobrado por moneda: solo trabajos terminados o entregados (un presupuesto o un
 * trabajo en curso todavía no se facturó). Mismo criterio que el saldo a cobrar del inicio.
 */
async function clientTotals(prisma: PrismaClient, clientId: number): Promise<CurrencyTotals[]> {
  const groups = await prisma.job.groupBy({
    by: ['currency'],
    where: { clientId, status: { in: [...DONE_JOB_STATUSES] } },
    _sum: { amountCharged: true, amountPaid: true },
    orderBy: { currency: 'asc' },
  });
  return groups.map(({ currency, _sum }) => ({
    currency,
    charged: _sum.amountCharged?.toNumber() ?? 0,
    paid: _sum.amountPaid?.toNumber() ?? 0,
  }));
}

async function toClientDetail(
  prisma: PrismaClient,
  { address, notes, updatedAt, ...row }: ClientDetailRow,
): Promise<AdminClientDetail> {
  return {
    ...toClientSummary(row),
    address,
    notes,
    updatedAt: updatedAt.toISOString(),
    totals: await clientTotals(prisma, row.id),
  };
}

export async function getClient(prisma: PrismaClient, id: number): Promise<AdminClientDetail> {
  const row = await prisma.client.findUnique({ where: { id }, select: clientDetailSelect });
  if (!row) throw clientNotFound();
  return toClientDetail(prisma, row);
}

export async function createClient(
  prisma: PrismaClient,
  input: ClientInputParsed,
): Promise<AdminClientDetail> {
  const row = await prisma.client.create({ data: input, select: clientDetailSelect });
  return toClientDetail(prisma, row);
}

export async function updateClient(
  prisma: PrismaClient,
  id: number,
  patch: ClientUpdateParsed,
): Promise<AdminClientDetail> {
  const row = await prisma.client
    .update({ where: { id }, data: patch, select: clientDetailSelect })
    .catch((error: unknown) => {
      if (isRecordNotFound(error)) throw clientNotFound();
      throw error;
    });
  return toClientDetail(prisma, row);
}

/** Borrado físico solo sin trabajos registrados (integridad del historial). */
export async function deleteClient(prisma: PrismaClient, id: number): Promise<void> {
  // Condición y borrado en una sola sentencia: no hay carrera con el alta de un trabajo.
  const { count } = await prisma.client.deleteMany({ where: { id, jobs: { none: {} } } });
  if (count > 0) return;

  const exists = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw clientNotFound();
  throw new AppError(
    409,
    'CLIENT_HAS_JOBS',
    'El cliente tiene trabajos registrados: no se puede borrar',
  );
}

// --- Exportación -----------------------------------------------------------

export async function exportClients(
  prisma: PrismaClient,
  filter: ClientsFilter,
  format: ExportFormat,
  now: Date,
): Promise<string | Buffer> {
  const where = clientsWhere(filter);
  const rows = await prisma.client.findMany({
    where,
    orderBy: clientsOrderBy,
    select: clientDetailSelect,
    take: exportRowLimit(format) + 1,
  });
  assertExportSize(rows.length, format);

  if (format === 'csv') {
    return toCsv(
      ['Nombre', 'Teléfono', 'Email', 'Dirección', 'Origen', 'Trabajos', 'Alta', 'Notas'],
      rows.map((row) => [
        row.fullName,
        csvDigits(row.phone),
        row.email,
        row.address,
        CLIENT_SOURCE_LABELS[row.source],
        row._count.jobs,
        formatDate(row.createdAt.toISOString()),
        row.notes,
      ]),
    );
  }

  const count = rows.length === 1 ? '1 cliente' : `${rows.length} clientes`;
  return renderTablePdf({
    title: 'Clientes',
    subtitle: [
      `Generado el ${formatDateTime(now.toISOString())}`,
      count,
      filter.q ? `Búsqueda: "${filter.q}"` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    columns: [
      { header: 'Nombre', weight: 3 },
      { header: 'Teléfono', weight: 2 },
      { header: 'Email', weight: 3 },
      { header: 'Dirección', weight: 3 },
      { header: 'Origen', weight: 1.5 },
      { header: 'Trabajos', weight: 1, align: 'right' },
      { header: 'Alta', weight: 1.5 },
    ],
    rows: rows.map((row) => [
      row.fullName,
      row.phone,
      row.email ?? '',
      row.address ?? '',
      CLIENT_SOURCE_LABELS[row.source],
      String(row._count.jobs),
      formatDate(row.createdAt.toISOString()),
    ]),
    emptyMessage: 'No hay clientes con estos filtros.',
  });
}
