import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  taskResponseSchema,
  taskListResponseSchema,
  timelineResponseSchema,
  activityResponseSchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  reminderStatusSchema,
  retryReminderResponseSchema,
} from '@crm/contracts';
import type { CreateTask, UpdateTask, CreateActivity, ResourceTarget } from '@crm/contracts';
import { useCommercialContext, commercialKeys, queryString } from '@/features/commercial/queries';
import type { Filters } from '@/features/commercial/queries';
export function useTasks(filters: Filters) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'tasks',
      filters,
    ),
    queryFn: ({ signal }) =>
      session.request(`tasks?${queryString(filters)}`, taskListResponseSchema, { signal }),
    enabled: context.permissions.includes('tasks.read'),
  });
}
export function useTask(id: string) {
  const { session, context } = useCommercialContext();
  return useQuery({
    queryKey: commercialKeys.detail(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'tasks',
      id,
    ),
    queryFn: ({ signal }) => session.request(`tasks/${id}`, taskResponseSchema, { signal }),
    enabled: context.permissions.includes('tasks.read'),
  });
}
export function useSaveTask(id?: string) {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTask | UpdateTask) =>
      session.request(id ? `tasks/${id}` : 'tasks', taskResponseSchema, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: root });
    },
  });
}
export function useTaskCommand() {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      command,
    }: {
      id: string;
      version: number;
      command: 'complete' | 'reopen' | 'archive';
    }) =>
      session.request(
        command === 'archive' ? `tasks/${id}` : `tasks/${id}/${command}`,
        taskResponseSchema,
        {
          method: command === 'archive' ? 'DELETE' : 'POST',
          body: JSON.stringify({ expectedVersion: version }),
        },
      ),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: root });
    },
  });
}
export function useTimeline(target: ResourceTarget) {
  const { session, context, root } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: [...root, 'timeline', target.type, target.id],
    initialPageParam: '',
    queryFn: ({ signal, pageParam }) =>
      session.request(
        `activities/${target.type}/${target.id}/timeline?${queryString({ limit: '25', cursor: pageParam })}`,
        timelineResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('activities.read'),
  });
}
export function useTaskHistory(id: string) {
  const { session, context, root } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: [...root, 'tasks', 'history', id],
    enabled: context.permissions.includes('tasks.read'),
    initialPageParam: '',
    queryFn: ({ signal, pageParam }) =>
      session.request(
        `tasks/${id}/history?${queryString({ limit: '25', cursor: pageParam })}`,
        timelineResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
  });
}
export function useCreateActivity() {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivity) =>
      session.request('activities', activityResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, 'timeline'] });
    },
  });
}
export function useNotifications(unread: boolean) {
  const { session, context, root } = useCommercialContext();
  return useInfiniteQuery({
    queryKey: [...root, 'notifications', { unread }],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `notifications?${queryString({ cursor: pageParam, limit: '25', ...(unread ? { unread: 'true' } : {}) })}`,
        notificationListResponseSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('notifications.read'),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}
export function useReadNotification() {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      session.request(`notifications/${id}/read`, notificationResponseSchema, { method: 'POST' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, 'notifications'] });
    },
  });
}
export function useReminder(id: string) {
  const { session, context, root } = useCommercialContext();
  return useQuery({
    queryKey: [...root, 'tasks', 'reminder', id],
    enabled: context.permissions.includes('tasks.read'),
    queryFn: ({ signal }) =>
      session.request(`tasks/${id}/reminder`, reminderStatusSchema, { signal }),
    refetchInterval: 30000,
  });
}
export function useRetryReminder() {
  const { session, root } = useCommercialContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      session.request(`tasks/${id}/reminder-retry`, retryReminderResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: version }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...root, 'tasks'] });
    },
  });
}
