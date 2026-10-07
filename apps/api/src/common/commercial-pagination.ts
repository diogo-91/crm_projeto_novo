import { z } from 'zod';
import { uuidSchema } from '@crm/contracts';
import { ApplicationError } from './application-error.js';
const positionSchema = z
  .object({
    id: uuidSchema,
    sort: z.enum(['name', 'createdAt', 'updatedAt']),
    direction: z.enum(['asc', 'desc']),
    value: z.string().max(160),
  })
  .strict();
export type CommercialPageQuery = {
  cursor?: string | undefined;
  limit: number;
  sort: 'name' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
};
export function cursorFilter(
  query: CommercialPageQuery,
  dateField: 'createdAt' | 'occurredAt' = 'createdAt',
) {
  if (!query.cursor) return {};
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new ApplicationError('INVALID_INPUT', 'Invalid pagination cursor.');
  }
  const position = positionSchema.safeParse(value);
  if (
    !position.success ||
    position.data.sort !== query.sort ||
    position.data.direction !== query.direction
  )
    throw new ApplicationError('INVALID_INPUT', 'Cursor and ordering must match.');
  const p = position.data;
  const key = query.direction === 'asc' ? 'gt' : 'lt';
  const comparison = query.sort === 'name' ? p.value : new Date(p.value);
  if (comparison instanceof Date && !Number.isFinite(comparison.getTime()))
    throw new ApplicationError('INVALID_INPUT', 'Invalid cursor date.');
  const field = query.sort === 'createdAt' ? dateField : query.sort;
  return {
    OR: [{ [field]: { [key]: comparison } }, { [field]: comparison, id: { [key]: p.id } }],
  };
}
export function commercialPage<
  T extends { id: string; name: string; createdAt: string; updatedAt: string },
>(rows: T[], query: CommercialPageQuery) {
  const data = rows.slice(0, query.limit);
  const last = data.at(-1);
  const hasNextPage = rows.length > query.limit;
  return {
    data,
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? Buffer.from(
              JSON.stringify({
                id: last.id,
                sort: query.sort,
                direction: query.direction,
                value: last[query.sort],
              }),
            ).toString('base64url')
          : null,
    },
  };
}
export function identityPage<T extends { id: string }>(rows: T[], limit: number) {
  const data = rows.slice(0, limit);
  const hasNextPage = rows.length > limit;
  return {
    data,
    pageInfo: { hasNextPage, nextCursor: hasNextPage ? (data.at(-1)?.id ?? null) : null },
  };
}
