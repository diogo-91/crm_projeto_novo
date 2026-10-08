'use client';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  quoteResponseSchema,
  quoteListResponseSchema,
  quoteHistoryResponseSchema,
  assignmentListResponseSchema,
} from '@crm/contracts';
import type { CreateQuote, UpdateQuote } from '@crm/contracts';
import { useCommercialContext, commercialKeys, queryString } from '@/features/commercial/queries';
import type { Filters } from '@/features/commercial/queries';
export function useQuotes(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'quotes',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`quotes?${queryString(filters)}`, quoteListResponseSchema, { signal }),
    enabled: context.permissions.includes('quotes.read'),
  });
}
export function useQuote(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'quotes',
      id,
    ),
    queryFn: ({ signal }) => session.request(`quotes/${id}`, quoteResponseSchema, { signal }),
    enabled: context.permissions.includes('quotes.read'),
  });
}
export function useQuoteHistory(id: string) {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'quote-history',
      id,
    ),
    initialPageParam: '0',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `quotes/${id}/history?afterVersion=${pageParam}`,
        quoteHistoryResponseSchema,
        { signal },
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('quotes.read'),
  });
}
export function useQuoteBranches() {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'quote-branches',
      {},
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `quotes/available-branches?${queryString({ cursor: pageParam, limit: '100' })}`,
        assignmentListResponseSchema,
        { signal },
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('quotes.create'),
  });
}
type Change =
  | { type: 'create'; input: CreateQuote; key: string }
  | { type: 'update'; id: string; input: UpdateQuote }
  | { type: 'approve'; id: string; version: number }
  | { type: 'revise'; id: string; version: number; key: string };
export function useQuoteMutation() {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: Change) => {
      if (change.type === 'create')
        return session.request('quotes', quoteResponseSchema, {
          method: 'POST',
          body: JSON.stringify(change.input),
          headers: { 'Idempotency-Key': change.key },
        });
      if (change.type === 'update')
        return session.request(`quotes/${change.id}`, quoteResponseSchema, {
          method: 'PATCH',
          body: JSON.stringify(change.input),
        });
      return session.request(
        `quotes/${change.id}/${change.type === 'approve' ? 'approvals' : 'revisions'}`,
        quoteResponseSchema,
        {
          method: 'POST',
          body: JSON.stringify({ expectedVersion: change.version }),
          ...(change.type === 'revise' ? { headers: { 'Idempotency-Key': change.key } } : {}),
        },
      );
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: root,
        predicate: (query) =>
          ['quotes', 'quote-history'].includes(String(query.queryKey[root.length])),
      });
    },
  });
}
