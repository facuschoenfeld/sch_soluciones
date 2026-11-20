import {
  applyPriceAdjustment,
  isValidAdjustedPrice,
  servicePriceIssue,
  type AdminServiceDetail,
  type AdminServiceSummary,
  type BulkPriceInput,
  type BulkPriceResult,
  type PublicServiceDetail,
  type PublicServiceSummary,
  type PublicServicesQuery,
  type ServiceInputParsed,
  type ServiceReorderInput,
  type ServiceUpdateParsed,
} from '@sch/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  BATCH_TRANSACTION_OPTIONS,
  fieldValidationError,
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
  orderMismatchError,
  sameIdSet,
  slugTakenError,
} from '../../lib/admin-errors.js';
import { AppError } from '../../lib/app-error.js';

const publicServiceSelect = {
  slug: true,
  name: true,
  shortDescription: true,
  priceType: true,
  priceAmount: true,
  currency: true,
  priceUnit: true,
  estimatedTime: true,
  isFeatured: true,
  whatsappTemplate: true,
  category: { select: { slug: true, name: true, line: true } },
} satisfies Prisma.ServiceSelect;

type PublicServiceRow = Prisma.ServiceGetPayload<{ select: typeof publicServiceSelect }>;

// Decimal → number: los montos tienen 2 decimales y entran holgados en un double.
function toPublicService(row: PublicServiceRow): PublicServiceSummary {
  return { ...row, priceAmount: row.priceAmount === null ? null : row.priceAmount.toNumber() };
}

/** Un servicio es público si está activo y su categoría también. */
const publicServiceWhere = {
  isActive: true,
  category: { isActive: true },
} satisfies Prisma.ServiceWhereInput;

/**
 * Prisma traduce `contains` a LIKE sin escapar sus comodines: "%" o "_" coincidirían con
 * cualquier texto. Se escapan con "\" (el carácter de escape por defecto de LIKE en Postgres).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function listPublicServices(
  prisma: PrismaClient,
  { category, q }: PublicServicesQuery,
): Promise<PublicServiceSummary[]> {
  const search = q === undefined ? undefined : escapeLikePattern(q);
  const where: Prisma.ServiceWhereInput = {
    ...publicServiceWhere,
    category: { isActive: true, ...(category && { slug: category }) },
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const rows = await prisma.service.findMany({
    where,
    // Agrupados por el orden de la categoría y, dentro de cada una, por el del servicio.
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: publicServiceSelect,
  });
  return rows.map(toPublicService);
}

export async function getPublicServiceBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<PublicServiceDetail> {
  const row = await prisma.service.findFirst({
    where: { ...publicServiceWhere, slug },
    select: { ...publicServiceSelect, description: true },
  });

  if (!row) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'El servicio no existe o ya no está disponible');
  }
  const { description, ...summary } = row;
  return { ...toPublicService(summary), description };
}

// --- Panel -----------------------------------------------------------------

const adminServiceSelect = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  shortDescription: true,
  priceType: true,
  priceAmount: true,
  currency: true,
  priceUnit: true,
  estimatedTime: true,
  isActive: true,
  isFeatured: true,
  sortOrder: true,
  priceUpdatedAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, line: true, isActive: true } },
  _count: { select: { jobs: true } },
} satisfies Prisma.ServiceSelect;

const adminServiceDetailSelect = {
  ...adminServiceSelect,
  description: true,
  whatsappTemplate: true,
} satisfies Prisma.ServiceSelect;

type AdminServiceRow = Prisma.ServiceGetPayload<{ select: typeof adminServiceSelect }>;
type AdminServiceDetailRow = Prisma.ServiceGetPayload<{ select: typeof adminServiceDetailSelect }>;

function toAdminService({
  _count,
  priceAmount,
  priceUpdatedAt,
  updatedAt,
  ...row
}: AdminServiceRow): AdminServiceSummary {
  return {
    ...row,
    priceAmount: priceAmount === null ? null : priceAmount.toNumber(),
    priceUpdatedAt: priceUpdatedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    jobsCount: _count.jobs,
  };
}

function toAdminServiceDetail({
  description,
  whatsappTemplate,
  ...row
}: AdminServiceDetailRow): AdminServiceDetail {
  return { ...toAdminService(row), description, whatsappTemplate };
}

export function serviceNotFound(): AppError {
  return new AppError(404, 'SERVICE_NOT_FOUND', 'El servicio no existe');
}

/** Traduce los errores de escritura esperables (incluidas carreras con un borrado) a 4xx. */
function rethrowWriteError(error: unknown): never {
  if (isUniqueViolation(error)) throw slugTakenError('Ya existe un servicio con ese slug');
  if (isRecordNotFound(error)) throw serviceNotFound();
  if (isForeignKeyViolation(error)) {
    throw fieldValidationError('categoryId', 'La categoría no existe');
  }
  throw error;
}

async function assertCategoryExists(prisma: PrismaClient, categoryId: number): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw fieldValidationError('categoryId', 'La categoría no existe');
}

/** Posición al final de la categoría (para altas y para servicios que cambian de categoría). */
async function nextSortOrder(prisma: PrismaClient, categoryId: number): Promise<number> {
  const { _max } = await prisma.service.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });
  return (_max.sortOrder ?? -1) + 1;
}

/** Orden del panel: el mismo que el del sitio (categoría, servicio, nombre). */
export async function listAdminServices(prisma: PrismaClient): Promise<AdminServiceSummary[]> {
  const rows = await prisma.service.findMany({
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: adminServiceSelect,
  });
  return rows.map(toAdminService);
}

export async function getAdminService(
  prisma: PrismaClient,
  id: number,
): Promise<AdminServiceDetail> {
  const row = await prisma.service.findUnique({ where: { id }, select: adminServiceDetailSelect });
  if (!row) throw serviceNotFound();
  return toAdminServiceDetail(row);
}

export async function createService(
  prisma: PrismaClient,
  input: ServiceInputParsed,
): Promise<AdminServiceDetail> {
  await assertCategoryExists(prisma, input.categoryId);
  const row = await prisma.service
    .create({
      data: {
        ...input,
        // "A consultar" no lleva monto (lo exige la restricción CHECK de la base).
        priceAmount: input.priceType === 'QUOTE' ? null : input.priceAmount,
        sortOrder: await nextSortOrder(prisma, input.categoryId),
      },
      select: adminServiceDetailSelect,
    })
    .catch(rethrowWriteError);
  return toAdminServiceDetail(row);
}

/**
 * Edición parcial. La regla de precio se valida sobre el resultado combinado (ej. pasar a
 * "Desde" sin enviar monto, con el servicio guardado como "a consultar", es un error).
 * `priceUpdatedAt` se actualiza solo si cambió el precio (tipo, monto o moneda).
 */
export async function updateService(
  prisma: PrismaClient,
  id: number,
  patch: ServiceUpdateParsed,
): Promise<AdminServiceDetail> {
  const current = await prisma.service.findUnique({
    where: { id },
    select: { categoryId: true, priceType: true, priceAmount: true, currency: true },
  });
  if (!current) throw serviceNotFound();

  const currentAmount = current.priceAmount === null ? null : current.priceAmount.toNumber();
  const priceType = patch.priceType ?? current.priceType;
  const currency = patch.currency ?? current.currency;
  const priceAmount =
    priceType === 'QUOTE'
      ? null
      : patch.priceAmount !== undefined
        ? patch.priceAmount
        : currentAmount;

  // Un monto suelto para un servicio "a consultar" se descartaría sin aviso: es un error.
  if (priceType === 'QUOTE' && patch.priceType === undefined && patch.priceAmount != null) {
    throw fieldValidationError(
      'priceAmount',
      'El servicio es "a consultar": cambiá el tipo de precio para cargar un monto',
    );
  }
  const issue = servicePriceIssue(priceType, priceAmount);
  if (issue) throw fieldValidationError('priceAmount', issue);

  const priceChanged =
    priceType !== current.priceType ||
    currency !== current.currency ||
    priceAmount !== currentAmount;

  const data: Prisma.ServiceUncheckedUpdateInput = {
    ...patch,
    priceType,
    priceAmount,
    currency,
    ...(priceChanged && { priceUpdatedAt: new Date() }),
  };
  if (patch.categoryId !== undefined && patch.categoryId !== current.categoryId) {
    await assertCategoryExists(prisma, patch.categoryId);
    data.sortOrder = await nextSortOrder(prisma, patch.categoryId);
  }

  const row = await prisma.service
    .update({ where: { id }, data, select: adminServiceDetailSelect })
    .catch(rethrowWriteError);
  return toAdminServiceDetail(row);
}

/** Borrado físico solo sin trabajos registrados; si tiene, se archiva (isActive = false). */
export async function deleteService(prisma: PrismaClient, id: number): Promise<void> {
  // Condición y borrado en una sola sentencia: no hay carrera con el alta de un trabajo.
  const { count } = await prisma.service.deleteMany({ where: { id, jobs: { none: {} } } });
  if (count > 0) return;

  const exists = await prisma.service.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw serviceNotFound();
  throw new AppError(
    409,
    'SERVICE_HAS_JOBS',
    'El servicio tiene trabajos registrados: archivalo en lugar de borrarlo',
  );
}

/** Recibe todos los servicios de una categoría en el orden nuevo. */
export async function reorderServices(
  prisma: PrismaClient,
  { categoryId, ids }: ServiceReorderInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.service.findMany({ where: { categoryId }, select: { id: true } });
    const currentIds = current.map((row) => row.id);
    if (!sameIdSet(currentIds, ids)) throw orderMismatchError();
    for (const [index, id] of ids.entries()) {
      // Por id y categoría: si entre la lectura y acá lo movieron o lo borraron, se cancela todo.
      const { count } = await tx.service.updateMany({
        where: { id, categoryId },
        data: { sortOrder: index },
      });
      if (count === 0) throw orderMismatchError();
    }
  }, BATCH_TRANSACTION_OPTIONS);
}

/**
 * Actualización masiva: aplica el ajuste a los servicios con precio (los "a consultar" se
 * informan como omitidos) y redondea al entero. Todo o nada: si algún resultado es inválido no
 * se guarda ninguno. Un monto fijo exige una sola moneda (sumar $ 2.000 a un precio en USD no
 * tiene sentido).
 */
export async function bulkUpdatePrices(
  prisma: PrismaClient,
  { serviceIds, adjustment }: BulkPriceInput,
): Promise<BulkPriceResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.service.findMany({
      where: { id: { in: serviceIds } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, priceType: true, priceAmount: true, currency: true },
    });
    if (rows.length !== serviceIds.length) {
      throw new AppError(
        404,
        'SERVICE_NOT_FOUND',
        'Alguno de los servicios ya no existe. Recargá la página e intentá de nuevo.',
      );
    }

    const skipped: BulkPriceResult['skipped'] = [];
    const updated: BulkPriceResult['updated'] = [];
    for (const row of rows) {
      if (row.priceType === 'QUOTE' || row.priceAmount === null) {
        skipped.push({ id: row.id, name: row.name });
        continue;
      }
      const before = row.priceAmount.toNumber();
      updated.push({
        id: row.id,
        name: row.name,
        currency: row.currency,
        before,
        after: applyPriceAdjustment(before, adjustment),
      });
    }

    if (updated.length === 0) {
      throw new AppError(
        400,
        'NOTHING_TO_UPDATE',
        'Los servicios elegidos son "a consultar": no tienen un precio para actualizar',
      );
    }
    if (adjustment.kind === 'AMOUNT' && new Set(updated.map((item) => item.currency)).size > 1) {
      throw new AppError(
        400,
        'MIXED_CURRENCIES',
        'Para sumar o restar un monto fijo, elegí servicios de una sola moneda',
      );
    }
    const invalid = updated.filter((item) => !isValidAdjustedPrice(item.after));
    if (invalid.length > 0) {
      throw new AppError(
        400,
        'INVALID_PRICE_RESULT',
        'El ajuste deja precios negativos o demasiado grandes',
        invalid.map(({ id, name }) => ({ id, name })),
      );
    }

    const now = new Date();
    for (const item of updated) {
      // Guarda optimista: si otro cambio (otra pestaña) tocó el precio después de leerlo, no se
      // pisa ni se choca con la restricción CHECK; se cancela todo.
      const { count } = await tx.service.updateMany({
        where: {
          id: item.id,
          priceType: { not: 'QUOTE' },
          priceAmount: item.before,
          // También la moneda: un cambio ARS → USD con el mismo monto saltearía MIXED_CURRENCIES.
          currency: item.currency,
        },
        data: { priceAmount: item.after, priceUpdatedAt: now },
      });
      if (count === 0) {
        throw new AppError(
          409,
          'PRICE_CHANGED',
          'Algún precio cambió mientras tanto. Recargá la página e intentá de nuevo.',
        );
      }
    }
    return { updated, skipped };
  }, BATCH_TRANSACTION_OPTIONS);
}
