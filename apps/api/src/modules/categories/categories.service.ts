import type { PublicCategory } from '@sch/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

export function listPublicCategories(prisma: PrismaClient): Promise<PublicCategory[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { slug: true, name: true, description: true, icon: true, line: true },
  });
}
