import { it, expect } from 'vitest';
import { commercialPage, cursorFilter } from './commercial-pagination.js';
const query = { limit: 1, sort: 'name' as const, direction: 'asc' as const };
const first = {
  id: 'f8e012b9-35a1-4779-a034-ae0a69085a5b',
  name: 'Same',
  createdAt: '2026-10-07T12:00:00Z',
  updatedAt: '2026-10-07T12:00:00Z',
};
it('keyset pagination preserves sort and UUID tie breaker', () => {
  const page = commercialPage(
    [first, { ...first, id: '98ff302c-948e-4d6e-a226-5f70dc88e990' }],
    query,
  );
  expect(page.data).toHaveLength(1);
  expect(cursorFilter({ ...query, cursor: page.pageInfo.nextCursor ?? '' })).toEqual({
    OR: [{ name: { gt: 'Same' } }, { name: 'Same', id: { gt: first.id } }],
  });
});
it('rejects malformed or mismatching cursors', () => {
  expect(() => cursorFilter({ ...query, cursor: 'garbage' })).toThrow();
  const page = commercialPage([first, first], query);
  expect(() =>
    cursorFilter({ ...query, sort: 'createdAt', cursor: page.pageInfo.nextCursor ?? '' }),
  ).toThrow();
});
it('empty and final pages do not invent a cursor or total', () =>
  expect(commercialPage([], query)).toEqual({
    data: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
  }));
