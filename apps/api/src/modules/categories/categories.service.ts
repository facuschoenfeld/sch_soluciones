import type {
  AdminCategory,
  CategoryInputParsed,
  CategoryUpdateParsed,
  PublicCategory,
} from '@sch/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  BATCH_TRANSACTION_OPTIONS,
  isRecordNotFound,
  isUniqueViolation,
  orderMismatchError,
  sameIdSet,
  slugTakenError,
} from '../../lib/admin-errors.js';
import { AppError } from '../../lib/app-error.js';

export function listPublicCategories(prisma: PrismaClient): Promise<PublicCategory[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { slug: true, name: true, description: true, icon: true, line: true },
  });
}

// --- Panel -----------------------------------------------------------------

const adminCategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  line: true,
  sortOrder: true,
  isActive: true,
  _count: { select: { services: true } },
} satisfies Prisma.CategorySelect;

type AdminCategoryRow = Prisma.CategoryGetPayload<{ select: typeof adminCategorySelect }>;

function toAdminCategory({ _count, ...row }: AdminCategoryRow): AdminCategory {
  return { ...row, servicesCount: _count.services };
}

export function categoryNotFound(): AppError {
  return new AppError(404, 'CATEGORY_NOT_FOUND', 'La categoría no existe');
}

/** Traduce los errores de escritura esperables (incluida la carrera con un borrado) a 4xx. */
function rethrowWriteError(error: unknown): never {
  if (isUniqueViolation(error)) throw slugTakenError('Ya existe una categoría con ese slug');
  if (isRecordNotFound(error)) throw categoryNotFound();
  throw error;
}

export async function listAdminCategories(prisma: PrismaClient): Promise<AdminCategory[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: adminCategorySelect,
  });
  return rows.map(toAdminCategory);
}

export async function createCategory(
  prisma: PrismaClient,
  input: CategoryInputParsed,
): Promise<AdminCategory> {
  // Las nuevas van al final del orden.
  const { _max } = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.category
    .create({
      data: { ...input, sortOrder: (_max.sortOrder ?? -1) + 1 },
      select: adminCategorySelect,
    })
    .catch(rethrowWriteError);
  return toAdminCategory(row);
}

export async function updateCategory(
  prisma: PrismaClient,
  id: number,
  patch: CategoryUpdateParsed,
): Promise<AdminCategory> {
  const exists = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw categoryNotFound();
  const row = await prisma.category
    .update({ where: { id }, data: patch, select: adminCategorySelect })
    .catch(rethrowWriteError);
  return toAdminCategory(row);
}

/** Solo se borra si no tiene servicios (ni archivados); si no, se desactiva. */
export async function deleteCategory(prisma: PrismaClient, id: number): Promise<void> {
  // Condición y borrado en una sola sentencia: no hay carrera con un alta de servicio.
  const { count } = await prisma.category.deleteMany({ where: { id, services: { none: {} } } });
  if (count > 0) return;

  const exists = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw categoryNotFound();
  throw new AppError(
    409,
    'CATEGORY_HAS_SERVICES',
    'La categoría tiene servicios: movelos a otra categoría o desactivala en lugar de borrarla',
  );
}

/** Recibe todas las categorías en el orden nuevo y guarda la posición de cada una. */
export async function reorderCategories(prisma: PrismaClient, ids: number[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.category.findMany({ select: { id: true } });
    const currentIds = current.map((row) => row.id);
    if (!sameIdSet(currentIds, ids)) throw orderMismatchError();
    for (const [index, id] of ids.entries()) {
      // Si la borraron entre la lectura y acá, se cancela todo (sin P2025 → 500).
      const { count } = await tx.category.updateMany({ where: { id }, data: { sortOrder: index } });
      if (count === 0) throw orderMismatchError();
    }
  }, BATCH_TRANSACTION_OPTIONS);
}
