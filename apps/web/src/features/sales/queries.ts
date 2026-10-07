'use client';
import { z } from 'zod';
import { toast } from '@crm/ui';
import { errorMessage } from '@/lib/api-client';
import type { InfiniteData } from '@tanstack/react-query';
import { optimisticStage, moveColumn } from './optimistic-move';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  leadResponseSchema,
  leadListResponseSchema,
  opportunityResponseSchema,
  opportunityListResponseSchema,
  pipelineResponseSchema,
  pipelineListResponseSchema,
  stageHistoryListResponseSchema,
  conversionResponseSchema,
} from '@crm/contracts';
import type {
  CreateLead,
  UpdateLead,
  CreateOpportunity,
  UpdateOpportunity,
  ConvertLead,
  CreatePipeline,
  UpdatePipeline,
  AddStage,
  UpdateStage,
  ReorderStages,
  MoveOpportunity,
  OpportunityResponse,
  StageResponse,
  OpportunityListResponse,
} from '@crm/contracts';
import { useCommercialContext, commercialKeys, queryString } from '@/features/commercial/queries';
import type { Filters } from '@/features/commercial/queries';
export function useLeads(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'leads',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`leads?${queryString(filters)}`, leadListResponseSchema, { signal }),
    enabled: context.permissions.includes('leads.read'),
  });
}
export function useLead(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'leads',
      id,
    ),
    queryFn: ({ signal }) => session.request(`leads/${id}`, leadResponseSchema, { signal }),
    enabled: context.permissions.includes('leads.read'),
  });
}
export function useOpportunities(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'opportunities',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`opportunities?${queryString(filters)}`, opportunityListResponseSchema, {
        signal,
      }),
    enabled: context.permissions.includes('opportunities.read'),
  });
}
export function useOpportunity(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'opportunities',
      id,
    ),
    queryFn: ({ signal }) =>
      session.request(`opportunities/${id}`, opportunityResponseSchema, { signal }),
    enabled: context.permissions.includes('opportunities.read'),
  });
}
export function usePipelines(branchId = '') {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'pipelines',
      { branchId },
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `pipelines?${queryString({ branchId, cursor: pageParam, limit: '100', active: 'true' })}`,
        pipelineListResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('pipelines.read'),
  });
}
export function usePipeline(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'pipelines',
      id,
    ),
    queryFn: ({ signal }) => session.request(`pipelines/${id}`, pipelineResponseSchema, { signal }),
    enabled: Boolean(id) && context.permissions.includes('pipelines.read'),
  });
}
export function useSaveLead(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLead | UpdateLead) =>
      session.request(id ? `leads/${id}` : 'leads', leadResponseSchema, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, 'leads'] });
    },
  });
}
export function useSaveOpportunity(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpportunity | UpdateOpportunity) =>
      session.request(id ? `opportunities/${id}` : 'opportunities', opportunityResponseSchema, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, 'opportunities'] });
    },
  });
}
export function useConvertLead(id: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ConvertLead) =>
      session.request(`leads/${id}/convert`, conversionResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: root });
    },
  });
}
export function usePipelineMutation(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (
      operation:
        | { type: 'create'; input: CreatePipeline }
        | { type: 'update'; input: UpdatePipeline }
        | { type: 'archive'; input: { expectedVersion: number } }
        | { type: 'add'; input: AddStage }
        | { type: 'stage'; stageId: string; input: UpdateStage }
        | { type: 'reorder'; input: ReorderStages },
    ) => {
      const suffix =
        operation.type === 'add'
          ? '/stages'
          : operation.type === 'stage'
            ? `/stages/${operation.stageId}`
            : operation.type === 'reorder'
              ? '/stages/reorder'
              : '';
      return session.request(
        operation.type === 'create' ? 'pipelines' : `pipelines/${id}${suffix}`,
        pipelineResponseSchema,
        {
          method:
            operation.type === 'archive'
              ? 'DELETE'
              : operation.type === 'update' || operation.type === 'stage'
                ? 'PATCH'
                : 'POST',
          body: JSON.stringify(operation.input),
        },
      );
    },
    onError: async (error) => {
      toast.error(errorMessage(error));
      await client.invalidateQueries({ queryKey: [...root, 'pipelines'] });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [...root, 'pipelines'] }),
        client.invalidateQueries({ queryKey: [...root, 'opportunities'] }),
      ]);
    },
  });
}
export function useStageHistory(id: string) {
  const { session, context } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'opportunities-history',
      id,
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `opportunities/${id}/stage-history?${queryString({ cursor: pageParam, limit: '25' })}`,
        stageHistoryListResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('opportunities.read'),
  });
}
export function useKanbanColumn(pipelineId: string, stageId: string, filters: Filters) {
  const { session, context } = useCommercialContext();
  const queryFilters = {
    ...filters,
    pipelineId,
    stageId,
    active: 'true',
    limit: '25',
    sort: 'createdAt',
    direction: 'desc',
  };
  return useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'opportunities-kanban',
      queryFilters,
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `opportunities?${queryString({ ...queryFilters, cursor: pageParam })}`,
        opportunityListResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('opportunities.read'),
  });
}
export function useMoveOpportunity() {
  const { session, context, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      record,
      input,
    }: {
      record: OpportunityResponse;
      input: MoveOpportunity;
      stage: StageResponse;
    }) =>
      session.request(`opportunities/${record.id}/stage`, opportunityResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async ({ record, stage, input }) => {
      const key = commercialKeys.detail(
        context.organizationId,
        context.membershipId,
        context.cacheScopeKey,
        'opportunities',
        record.id,
      );
      await Promise.all(
        ['opportunities', 'opportunities-kanban'].map((resource) =>
          client.cancelQueries({ queryKey: [...root, resource] }),
        ),
      );
      const columns = client.getQueriesData<InfiniteData<OpportunityListResponse>>({
        queryKey: [...root, 'opportunities-kanban'],
      });
      const filterKey = (key: readonly unknown[]) => {
        const parsed = z.record(z.string(), z.string()).safeParse(key[6]);
        if (!parsed.success) return null;
        const filters = { ...parsed.data };
        delete filters['stageId'];
        return JSON.stringify(Object.entries(filters).sort(([a], [b]) => a.localeCompare(b)));
      };
      const sourceFilters = new Set(
        columns
          .filter(([, data]) =>
            data?.pages.some((page) => page.data.some((row) => row.id === record.id)),
          )
          .map(([key]) => filterKey(key)),
      );
      const optimistic = optimisticStage(record, stage, input);
      for (const [columnKey, data] of columns) {
        if (!data) continue;
        const parsed = z.record(z.string(), z.string()).safeParse(columnKey[6]);
        const insert =
          parsed.success &&
          parsed.data['stageId'] === stage.id &&
          sourceFilters.has(filterKey(columnKey));
        client.setQueryData(columnKey, moveColumn(data, optimistic, insert));
      }
      const previous = client.getQueryData<OpportunityResponse>(key);
      client.setQueryData(key, optimistic);
      return { key, previous, columns };
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot) {
        for (const [key, data] of snapshot.columns) if (data) client.setQueryData(key, data);
        if (snapshot.previous) client.setQueryData(snapshot.key, snapshot.previous);
        else client.removeQueries({ queryKey: snapshot.key, exact: true });
      }
    },
    onSuccess: (result, _variables, snapshot) => {
      if (snapshot) client.setQueryData(snapshot.key, result);
    },
    onSettled: async () => {
      await Promise.all(
        ['opportunities', 'opportunities-kanban', 'opportunities-history', 'leads'].map(
          (resource) => client.invalidateQueries({ queryKey: [...root, resource] }),
        ),
      );
    },
  });
}
