import type { Paginated, PaginationQuery } from '@sch/shared';

/** `skip`/`take` de Prisma para `?page=&pageSize=`. */
export function pageArgs({ page, pageSize }: PaginationQuery): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(
  data: T[],
  { page, pageSize }: PaginationQuery,
  total: number,
): Paginated<T> {
  return { data, meta: { page, pageSize, total } };
}
