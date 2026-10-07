'use client';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  companyListResponseSchema,
  contactListResponseSchema,
  companyResponseSchema,
  contactResponseSchema,
  assignmentListResponseSchema,
  tagListResponseSchema,
  tagResponseSchema,
  leadResponseSchema,
  opportunityResponseSchema,
} from '@crm/contracts';
import type {
  CreateContact,
  UpdateContact,
  CreateCompany,
  UpdateCompany,
  CreateTag,
  UpdateTag,
} from '@crm/contracts';
import { useAuth } from '@/features/auth/auth-provider';
export type CommercialResource = 'contacts' | 'companies' | 'leads' | 'opportunities';
export type Filters = Record<string, string>;
export function queryString(filters: Filters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== ''),
  ).toString();
}
export const commercialKeys = {
  root: (organizationId: string, membershipId: string, scopeKey: string) =>
    ['commercial', organizationId, membershipId, scopeKey] as const,
  list: (org: string, member: string, scopeKey: string, resource: string, filters: Filters) =>
    [...commercialKeys.root(org, member, scopeKey), resource, 'list', filters] as const,
  detail: (org: string, member: string, scopeKey: string, resource: string, id: string) =>
    [...commercialKeys.root(org, member, scopeKey), resource, 'detail', id] as const,
};
export function useCommercialContext() {
  const { state, session } = useAuth();
  if (state.status !== 'authenticated' || !state.me.context)
    throw new Error('Authenticated organization required');
  return {
    session,
    context: state.me.context,
    root: commercialKeys.root(
      state.me.context.organizationId,
      state.me.context.membershipId,
      state.me.context.cacheScopeKey,
    ),
  };
}
export function useContacts(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'contacts',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`contacts?${queryString(filters)}`, contactListResponseSchema, { signal }),
    enabled: context.permissions.includes('contacts.read'),
  });
}
export function useCompanies(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'companies',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`companies?${queryString(filters)}`, companyListResponseSchema, { signal }),
    enabled: context.permissions.includes('companies.read'),
  });
}
export function useContact(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'contacts',
      id,
    ),
    queryFn: ({ signal }) => session.request(`contacts/${id}`, contactResponseSchema, { signal }),
    enabled: context.permissions.includes('contacts.read'),
  });
}
export function useCompany(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'companies',
      id,
    ),
    queryFn: ({ signal }) => session.request(`companies/${id}`, companyResponseSchema, { signal }),
    enabled: context.permissions.includes('companies.read'),
  });
}
export function useTags(filters: Filters = { active: 'true', limit: '100' }) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'tags',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`tags?${queryString(filters)}`, tagListResponseSchema, { signal }),
    enabled: context.permissions.includes('tags.read'),
  });
}
export function useAssignment(
  resource: CommercialResource,
  kind: 'branches' | 'owners',
  action: 'create' | 'update' | 'read',
  branchId: string,
) {
  const { session, context } = useCommercialContext();
  const filters = { action, branchId: kind === 'owners' ? branchId : '', limit: '100' };
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      `${resource}-assignment-${kind}`,
      filters,
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `${resource}/assignment-${kind}?${queryString({ ...filters, cursor: pageParam })}`,
        assignmentListResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled:
      context.permissions.includes(`${resource}.${action}`) &&
      (kind === 'branches' || Boolean(branchId)),
  });
}
export function useTagChoices() {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'tags-choices',
      {
        active: 'true',
      },
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `tags?${queryString({ active: 'true', limit: '100', cursor: pageParam })}`,
        tagListResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('tags.read'),
  });
}
export function useSaveContact(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContact | UpdateContact) =>
      session.request(id ? `contacts/${id}` : 'contacts', contactResponseSchema, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, 'contacts'] });
    },
  });
}
export function useSaveCompany(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompany | UpdateCompany) =>
      session.request(id ? `companies/${id}` : 'companies', companyResponseSchema, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [...root, 'companies'] }),
        client.invalidateQueries({ queryKey: [...root, 'contacts'] }),
      ]);
    },
  });
}
export function useSaveTag(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTag | UpdateTag) =>
      session.request(id ? `tags/${id}` : 'tags', tagResponseSchema, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [...root, 'tags'] }),
        client.invalidateQueries({ queryKey: [...root, 'tags-choices'] }),
        client.invalidateQueries({ queryKey: [...root, 'contacts'] }),
      ]);
    },
  });
}
export function useArchive(resource: CommercialResource | 'tags') {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      session.request(
        `${resource}/${id}`,
        resource === 'contacts'
          ? contactResponseSchema
          : resource === 'companies'
            ? companyResponseSchema
            : resource === 'leads'
              ? leadResponseSchema
              : resource === 'opportunities'
                ? opportunityResponseSchema
                : tagResponseSchema,
        { method: 'DELETE', body: JSON.stringify({ expectedVersion: version }) },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, resource] });
      if (resource === 'tags')
        await client.invalidateQueries({ queryKey: [...root, 'tags-choices'] });
      if (resource !== 'contacts')
        await client.invalidateQueries({ queryKey: [...root, 'contacts'] });
    },
  });
}
