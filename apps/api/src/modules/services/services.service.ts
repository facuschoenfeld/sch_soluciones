import type { PublicServiceDetail, PublicServiceSummary, PublicServicesQuery } from '@sch/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
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
