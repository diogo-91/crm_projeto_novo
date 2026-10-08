'use client';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productListResponseSchema,
  productResponseSchema,
  priceListListResponseSchema,
  priceListResponseSchema,
  priceItemListResponseSchema,
  priceBranchOptionsSchema,
} from '@crm/contracts';
import type {
  ProductResponse,
  PriceListResponse,
  CreateProduct,
  UpdateProduct,
  CreatePriceList,
  UpdatePriceList,
} from '@crm/contracts';
import { useCommercialContext, commercialKeys, queryString } from '@/features/commercial/queries';
import type { Filters } from '@/features/commercial/queries';
export function useProducts(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'products',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`products?${queryString(filters)}`, productListResponseSchema, { signal }),
    enabled: context.permissions.includes('products.read'),
  });
}
export function useProduct(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'products',
      id,
    ),
    queryFn: ({ signal }) => session.request(`products/${id}`, productResponseSchema, { signal }),
    enabled: context.permissions.includes('products.read'),
  });
}
export function usePriceLists(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'price-lists',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`price-lists?${queryString(filters)}`, priceListListResponseSchema, {
        signal,
      }),
    enabled: context.permissions.includes('price-lists.read'),
  });
}
export function usePriceList(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'price-lists',
      id,
    ),
    queryFn: ({ signal }) =>
      session.request(`price-lists/${id}`, priceListResponseSchema, { signal }),
    enabled: context.permissions.includes('price-lists.read'),
  });
}
export function usePrices(id: string, filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'price-list-items',
      { ...filters, listId: id },
    ),
    queryFn: ({ signal }) =>
      session.request(
        `price-lists/${id}/items?${queryString(filters)}`,
        priceItemListResponseSchema,
        { signal },
      ),
    enabled:
      context.permissions.includes('price-lists.read') &&
      context.permissions.includes('products.read'),
  });
}
export function usePriceBranches() {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'price-branches',
      {},
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `price-lists/available-branches?${queryString({ cursor: pageParam, limit: '100' })}`,
        priceBranchOptionsSchema,
        { signal },
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('price-lists.manage'),
  });
}
export function useProductOptions(search: string) {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'product-options',
      { search },
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `products?${queryString({ search, cursor: pageParam, limit: '100', active: 'true' })}`,
        productListResponseSchema,
        { signal },
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('products.read'),
  });
}
type Change =
  | { type: 'product'; id?: string; input: CreateProduct | UpdateProduct }
  | { type: 'list'; id?: string; input: CreatePriceList | UpdatePriceList }
  | { type: 'archive'; resource: 'products' | 'price-lists'; id: string; version: number }
  | { type: 'price'; id: string; productId: string; unitPrice: string; version: number }
  | { type: 'remove-price'; id: string; productId: string; version: number };
export function useCatalogMutation() {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: Change): Promise<ProductResponse | PriceListResponse> => {
      if (change.type === 'product')
        return session.request(
          change.id ? `products/${change.id}` : 'products',
          productResponseSchema,
          { method: change.id ? 'PATCH' : 'POST', body: JSON.stringify(change.input) },
        );
      if (change.type === 'list')
        return session.request(
          change.id ? `price-lists/${change.id}` : 'price-lists',
          priceListResponseSchema,
          { method: change.id ? 'PATCH' : 'POST', body: JSON.stringify(change.input) },
        );
      if (change.type === 'archive') {
        const options = {
          method: 'DELETE',
          body: JSON.stringify({ expectedVersion: change.version }),
        };
        return change.resource === 'products'
          ? session.request(`products/${change.id}`, productResponseSchema, options)
          : session.request(`price-lists/${change.id}`, priceListResponseSchema, options);
      }
      return session.request(
        `price-lists/${change.id}/items/${change.productId}`,
        priceListResponseSchema,
        {
          method: change.type === 'price' ? 'PUT' : 'DELETE',
          body: JSON.stringify({
            expectedVersion: change.version,
            ...(change.type === 'price' ? { unitPrice: change.unitPrice } : {}),
          }),
        },
      );
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: root,
        predicate: (query) => {
          const resource = query.queryKey[root.length];
          return (
            typeof resource === 'string' &&
            ['products', 'product-options', 'price-lists', 'price-list-items'].includes(resource)
          );
        },
      });
    },
  });
}
