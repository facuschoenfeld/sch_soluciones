import {
  DONE_JOB_STATUSES,
  JOB_STATUS_LABELS,
  balanceDue,
  businessDayRange,
  formatAmount,
  formatDate,
  formatDateTime,
  isDoneJobStatus,
  jobAmountsIssue,
  jobStatusChangeIssue,
  type AdminJob,
  type DeviceInfo,
  type DeviceInfoParsed,
  type ExportFormat,
  type JobInputParsed,
  type JobUpdateParsed,
  type JobsFilter,
  type JobsQuery,
  type Paginated,
} from '@sch/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import {
  fieldValidationError,
  isForeignKeyViolation,
  isRecordNotFound,
} from '../../lib/admin-errors.js';
import { AppError } from '../../lib/app-error.js';
import { assertExportSize, csvAmount, csvDigits, exportRowLimit, toCsv } from '../../lib/export.js';
import { pageArgs, paginated } from '../../lib/pagination.js';
import { renderTablePdf } from '../../lib/pdf-table.js';

// Trabajos del mini CRM. Al asignar un servicio se guarda un snapshot de su nombre y precio:
// cambiar o borrar el servicio después no altera el historial.

const jobSelect = {
  id: true,
  clientId: true,
  client: { select: { id: true, fullName: true, phone: true } },
  serviceId: true,
  service: { select: { id: true, name: true, isActive: true } },
  serviceNameSnapshot: true,
  servicePriceSnapshot: true,
  servicePriceTypeSnapshot: true,
  serviceCurrencySnapshot: true,
  title: true,
  description: true,
  deviceInfo: true,
  status: true,
  amountCharged: true,
  currency: true,
  amountPaid: true,
  receivedAt: true,
  scheduledAt: true,
  completedAt: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JobSelect;

type JobRow = Prisma.JobGetPayload<{ select: typeof jobSelect }>;

/** `deviceInfo` es JSON: se lee campo por campo (solo strings) en vez de confiar en la forma. */
function toDeviceInfo(value: Prisma.JsonValue | null): DeviceInfo | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const read = (key: keyof DeviceInfo) => {
    const field = value[key];
    return typeof field === 'string' ? field : null;
  };
  return {
    brand: read('brand'),
    model: read('model'),
    serialNumber: read('serialNumber'),
    reportedIssue: read('reportedIssue'),
  };
}

function toAdminJob({
  servicePriceSnapshot,
  deviceInfo,
  amountCharged,
  amountPaid,
  receivedAt,
  scheduledAt,
  completedAt,
  createdAt,
  updatedAt,
  ...row
}: JobRow): AdminJob {
  return {
    ...row,
    servicePriceSnapshot: servicePriceSnapshot === null ? null : servicePriceSnapshot.toNumber(),
    deviceInfo: toDeviceInfo(deviceInfo),
    amountCharged: amountCharged.toNumber(),
    amountPaid: amountPaid.toNumber(),
    receivedAt: receivedAt.toISOString(),
    scheduledAt: scheduledAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** JSON nullable: Prisma exige `DbNull` para guardar NULL en la columna. */
function deviceInfoData(value: DeviceInfoParsed) {
  return value ?? Prisma.DbNull;
}

export function jobNotFound(): AppError {
  return new AppError(404, 'JOB_NOT_FOUND', 'El trabajo no existe');
}

function jobChangedError(): AppError {
  return new AppError(
    409,
    'JOB_CHANGED',
    'El trabajo cambió mientras tanto (¿otra pestaña?). Recargá la página e intentá de nuevo.',
  );
}

async function assertClientExists(prisma: PrismaClient, clientId: number): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw fieldValidationError('clientId', 'El cliente no existe');
}

/** Snapshot del servicio al asignarlo (o vacío si el trabajo queda sin servicio). */
async function serviceSnapshot(prisma: PrismaClient, serviceId: number | null) {
  if (serviceId === null) {
    return {
      serviceNameSnapshot: null,
      servicePriceSnapshot: null,
      servicePriceTypeSnapshot: null,
      serviceCurrencySnapshot: null,
    };
  }
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { name: true, priceType: true, priceAmount: true, currency: true },
  });
  if (!service) throw fieldValidationError('serviceId', 'El servicio no existe');
  return {
    serviceNameSnapshot: service.name,
    servicePriceSnapshot: service.priceAmount,
    servicePriceTypeSnapshot: service.priceType,
    serviceCurrencySnapshot: service.priceType === 'QUOTE' ? null : service.currency,
  };
}

/**
 * El cliente o el servicio se borraron entre la verificación y la escritura: se responde como
 * si no hubieran existido (400 en el campo), no con un 500.
 */
async function rethrowWriteError(
  prisma: PrismaClient,
  error: unknown,
  ids: { clientId?: number; serviceId?: number | null },
): Promise<never> {
  if (isRecordNotFound(error)) throw jobNotFound();
  if (isForeignKeyViolation(error)) {
    if (ids.clientId !== undefined) await assertClientExists(prisma, ids.clientId);
    if (ids.serviceId != null) await serviceSnapshot(prisma, ids.serviceId);
  }
  throw error;
}

// --- Listado ---------------------------------------------------------------

function jobsWhere(prisma: PrismaClient, filter: JobsFilter): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [];
  if (filter.status) and.push({ status: filter.status });
  if (filter.clientId) and.push({ clientId: filter.clientId });
  if (filter.serviceId) and.push({ serviceId: filter.serviceId });
  if (filter.from || filter.to) {
    and.push({
      receivedAt: {
        ...(filter.from && { gte: businessDayRange(filter.from, filter.from).start }),
        ...(filter.to && { lt: businessDayRange(filter.to, filter.to).end }),
      },
    });
  }
  if (filter.balanceDue) and.push(balanceDueWhere(prisma));
  return and.length > 0 ? { AND: and } : {};
}

/** Terminados o entregados con saldo a cobrar (lo pagado es menor que el total). */
export function balanceDueWhere(prisma: PrismaClient): Prisma.JobWhereInput {
  return {
    status: { in: [...DONE_JOB_STATUSES] },
    amountPaid: { lt: prisma.job.fields.amountCharged },
  };
}

/** Más recientes primero (por fecha de ingreso). */
const jobsOrderBy = [
  { receivedAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.JobOrderByWithRelationInput[];

export async function listJobs(
  prisma: PrismaClient,
  query: JobsQuery,
): Promise<Paginated<AdminJob>> {
  const where = jobsWhere(prisma, query);
  const [total, rows] = await prisma.$transaction([
    prisma.job.count({ where }),
    prisma.job.findMany({ where, orderBy: jobsOrderBy, select: jobSelect, ...pageArgs(query) }),
  ]);
  return paginated(rows.map(toAdminJob), query, total);
}

export async function getJob(prisma: PrismaClient, id: number): Promise<AdminJob> {
  const row = await prisma.job.findUnique({ where: { id }, select: jobSelect });
  if (!row) throw jobNotFound();
  return toAdminJob(row);
}

// --- Escrituras ------------------------------------------------------------

export async function createJob(
  prisma: PrismaClient,
  { deviceInfo, ...input }: JobInputParsed,
  now: Date,
): Promise<AdminJob> {
  await assertClientExists(prisma, input.clientId);
  const snapshot = await serviceSnapshot(prisma, input.serviceId);
  const row = await prisma.job
    .create({
      data: {
        ...input,
        ...snapshot,
        deviceInfo: deviceInfoData(deviceInfo),
        // Un trabajo terminado siempre tiene fecha de terminado (cuenta en los ingresos del mes).
        completedAt: input.completedAt ?? (isDoneJobStatus(input.status) ? now : null),
      },
      select: jobSelect,
    })
    .catch((error: unknown) => rethrowWriteError(prisma, error, input));
  return toAdminJob(row);
}

/**
 * Edición parcial. Se valida sobre el trabajo combinado con los cambios: lo pagado no puede
 * superar el total y un entregado no se cancela. Cambiar el servicio toma un snapshot nuevo.
 * La escritura lleva una guarda optimista (`updatedAt` leído): si otra petición modificó el
 * trabajo en el medio, se responde 409 en vez de mezclar los cambios sin validar.
 */
export async function updateJob(
  prisma: PrismaClient,
  id: number,
  { deviceInfo, ...patch }: JobUpdateParsed,
  now: Date,
): Promise<AdminJob> {
  const current = await prisma.job.findUnique({
    where: { id },
    select: {
      status: true,
      serviceId: true,
      amountCharged: true,
      amountPaid: true,
      completedAt: true,
      updatedAt: true,
    },
  });
  if (!current) throw jobNotFound();

  const status = patch.status ?? current.status;
  const statusIssue = jobStatusChangeIssue(current.status, status);
  if (statusIssue) {
    throw new AppError(409, 'INVALID_STATUS_CHANGE', statusIssue, [
      { path: ['status'], message: statusIssue },
    ]);
  }

  const amountsIssue = jobAmountsIssue(
    patch.amountCharged ?? current.amountCharged.toNumber(),
    patch.amountPaid ?? current.amountPaid.toNumber(),
  );
  if (amountsIssue) {
    // El error va en el campo que se envió (si solo cambió el total, en el total).
    const field = patch.amountPaid === undefined ? 'amountCharged' : 'amountPaid';
    throw fieldValidationError(field, amountsIssue);
  }

  const data: Prisma.JobUncheckedUpdateManyInput = { ...patch };
  if (deviceInfo !== undefined) data.deviceInfo = deviceInfoData(deviceInfo);
  if (patch.clientId !== undefined) await assertClientExists(prisma, patch.clientId);
  if (patch.serviceId !== undefined && patch.serviceId !== current.serviceId) {
    Object.assign(data, await serviceSnapshot(prisma, patch.serviceId));
  }
  // La fecha de terminado acompaña al estado (salvo que el PATCH la traiga): al reabrir un
  // terminado (volver a En curso, cancelarlo) se borra, y al terminarlo toma la fecha de ahora,
  // aunque se hubiera cargado otra mientras estaba abierto. Si no, sus ingresos quedarían
  // contados en otro mes. Un terminado nunca queda sin fecha.
  const wasDone = isDoneJobStatus(current.status);
  const isDone = isDoneJobStatus(status);
  if (patch.completedAt === undefined) {
    if (wasDone && !isDone) data.completedAt = null;
    else if (!wasDone && isDone) data.completedAt = now;
    else if (isDone && current.completedAt === null) data.completedAt = now;
  } else if (patch.completedAt === null && isDone) {
    data.completedAt = now;
  }

  const { count } = await prisma.job
    .updateMany({ where: { id, updatedAt: current.updatedAt }, data })
    .catch((error: unknown) => rethrowWriteError(prisma, error, patch));
  if (count === 0) {
    const exists = await prisma.job.findUnique({ where: { id }, select: { id: true } });
    throw exists ? jobChangedError() : jobNotFound();
  }
  return getJob(prisma, id);
}

export async function deleteJob(prisma: PrismaClient, id: number): Promise<void> {
  await prisma.job.delete({ where: { id }, select: { id: true } }).catch((error: unknown) => {
    if (isRecordNotFound(error)) throw jobNotFound();
    throw error;
  });
}

// --- Exportación -----------------------------------------------------------

/** Descripción legible de los filtros para el encabezado del PDF. */
async function describeFilter(prisma: PrismaClient, filter: JobsFilter): Promise<string[]> {
  const parts: string[] = [];
  if (filter.status) parts.push(`Estado: ${JOB_STATUS_LABELS[filter.status]}`);
  if (filter.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: filter.clientId },
      select: { fullName: true },
    });
    if (client) parts.push(`Cliente: ${client.fullName}`);
  }
  if (filter.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: filter.serviceId },
      select: { name: true },
    });
    if (service) parts.push(`Servicio: ${service.name}`);
  }
  if (filter.from)
    parts.push(
      `Desde: ${formatDate(businessDayRange(filter.from, filter.from).start.toISOString())}`,
    );
  if (filter.to)
    parts.push(`Hasta: ${formatDate(businessDayRange(filter.to, filter.to).start.toISOString())}`);
  if (filter.balanceDue) parts.push('Solo con saldo a cobrar');
  return parts;
}

export async function exportJobs(
  prisma: PrismaClient,
  filter: JobsFilter,
  format: ExportFormat,
  now: Date,
): Promise<string | Buffer> {
  const where = jobsWhere(prisma, filter);
  const rows = await prisma.job.findMany({
    where,
    orderBy: jobsOrderBy,
    select: jobSelect,
    take: exportRowLimit(format) + 1,
  });
  assertExportSize(rows.length, format);
  const jobs = rows.map(toAdminJob);
  const serviceName = (job: AdminJob) => job.serviceNameSnapshot ?? job.service?.name ?? null;

  if (format === 'csv') {
    return toCsv(
      [
        'Ingreso',
        'Cliente',
        'Teléfono',
        'Trabajo',
        'Servicio',
        'Estado',
        'Moneda',
        'Total',
        'Pagado',
        'Saldo',
        'Turno',
        'Terminado',
        'Marca',
        'Modelo',
        'N° de serie',
        'Falla reportada',
        'Descripción',
        'Notas internas',
      ],
      jobs.map((job) => [
        formatDate(job.receivedAt),
        job.client.fullName,
        csvDigits(job.client.phone),
        job.title,
        serviceName(job),
        JOB_STATUS_LABELS[job.status],
        job.currency,
        csvAmount(job.amountCharged),
        csvAmount(job.amountPaid),
        csvAmount(balanceDue(job.amountCharged, job.amountPaid)),
        job.scheduledAt && formatDateTime(job.scheduledAt),
        job.completedAt && formatDate(job.completedAt),
        job.deviceInfo?.brand ?? null,
        job.deviceInfo?.model ?? null,
        // Solo dígitos → texto para Excel (conserva ceros a la izquierda); el resto, tal cual.
        job.deviceInfo?.serialNumber ? csvDigits(job.deviceInfo.serialNumber) : null,
        job.deviceInfo?.reportedIssue ?? null,
        job.description,
        job.internalNotes,
      ]),
    );
  }

  const count = jobs.length === 1 ? '1 trabajo' : `${jobs.length} trabajos`;
  return renderTablePdf({
    title: 'Trabajos',
    subtitle: [
      `Generado el ${formatDateTime(now.toISOString())}`,
      count,
      ...(await describeFilter(prisma, filter)),
    ].join(' · '),
    columns: [
      { header: 'Ingreso', weight: 1.4 },
      { header: 'Cliente', weight: 2.5 },
      { header: 'Trabajo', weight: 3.5 },
      { header: 'Servicio', weight: 2.5 },
      { header: 'Estado', weight: 1.5 },
      { header: 'Total', weight: 1.6, align: 'right' },
      { header: 'Pagado', weight: 1.6, align: 'right' },
      { header: 'Saldo', weight: 1.6, align: 'right' },
      { header: 'Terminado', weight: 1.4 },
    ],
    rows: jobs.map((job) => [
      formatDate(job.receivedAt),
      job.client.fullName,
      job.title,
      serviceName(job) ?? '',
      JOB_STATUS_LABELS[job.status],
      formatAmount(job.amountCharged, job.currency),
      formatAmount(job.amountPaid, job.currency),
      formatAmount(balanceDue(job.amountCharged, job.amountPaid), job.currency),
      job.completedAt ? formatDate(job.completedAt) : '',
    ]),
    emptyMessage: 'No hay trabajos con estos filtros.',
  });
}
