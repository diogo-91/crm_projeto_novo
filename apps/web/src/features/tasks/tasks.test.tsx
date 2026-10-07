import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, it, expect, vi } from 'vitest';
import { BroadcastChannel as NativeBroadcastChannel } from 'node:worker_threads';
import type { ReactNode } from 'react';
import type { TaskResponse } from '@crm/contracts';
import { AuthProvider } from '@/features/auth/auth-provider';
import { CommercialQueryProvider } from '@/lib/commercial-query-provider';
import { TaskList } from './task-list';
import { TaskForm } from './task-form';
import { Timeline } from './timeline';
import { NotificationsInbox } from './notifications-inbox';
import { localDateInput } from './dates';
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), params: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => '/tasks',
  useSearchParams: () => new URLSearchParams(navigation.params),
}));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  branchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const dates = { createdAt: '2026-10-07T12:00:00.000Z', updatedAt: '2026-10-07T12:00:00.000Z' };
const record: TaskResponse = {
  ...dates,
  id,
  name: 'Follow-up test',
  description: null,
  branch: { id: branchId, name: 'Branch' },
  owner: { id, name: 'Owner' },
  kind: 'FOLLOW_UP',
  priority: 'NORMAL',
  status: 'OPEN',
  dueAt: null,
  remindAt: null,
  completedAt: null,
  target: null,
  active: true,
  version: 3,
};
const permissions = [
  'tasks.read',
  'tasks.create',
  'tasks.update',
  'activities.read',
  'activities.create',
  'notifications.read',
  'notifications.update',
];
const auth = {
  accessToken: 'memory-only',
  expiresIn: 900,
  sessionExpiresAt: '2026-11-01T00:00:00.000Z',
  user: { ...dates, id, name: 'Owner', email: 'owner@example.test', active: true },
  memberships: [{ membershipId: id, organizationId: id, organizationName: 'A' }],
  context: {
    organizationId: id,
    organizationName: 'A',
    membershipId: id,
    primaryBranchId: branchId,
    branches: [{ id: branchId, name: 'Branch', code: 'B' }],
    roles: [],
    cacheScopeKey: 'a'.repeat(64),
    permissions,
  },
};
const pageInfo = { hasNextPage: false, nextCursor: null };
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}
function setup(
  handler?: (path: string, init: RequestInit | undefined) => Response,
  allowed = permissions,
) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.test/api/v1');
  vi.stubGlobal('BroadcastChannel', NativeBroadcastChannel);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: <T,>(_: string, work: () => Promise<T>) => work() },
  });
  const transport = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const path = (
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    ).replace('https://api.test/api/v1/', '');
    if (path === 'auth/refresh')
      return Promise.resolve(json({ ...auth, context: { ...auth.context, permissions: allowed } }));
    if (handler) return Promise.resolve(handler(path, init));
    if (path.includes('assignment-branches'))
      return Promise.resolve(json({ data: [record.branch], pageInfo }));
    if (path.includes('assignment-owners'))
      return Promise.resolve(json({ data: [record.owner], pageInfo }));
    return Promise.resolve(json({ data: [], pageInfo }));
  });
  vi.stubGlobal('fetch', transport);
  return transport;
}
function Harness({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CommercialQueryProvider>{children}</CommercialQueryProvider>
    </AuthProvider>
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  navigation.params = '';
  navigation.replace.mockReset();
});
it('task list renders authorized empty state and creation action', async () => {
  setup();
  render(
    <Harness>
      <TaskList />
    </Harness>,
  );
  expect(await screen.findByText('Nenhuma tarefa encontrada')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Nova tarefa' })).toBeTruthy();
});
it('denied task users do not fetch lists or expose creation', async () => {
  const transport = setup(undefined, []);
  render(
    <Harness>
      <TaskList />
    </Harness>,
  );
  await screen.findByText('Acesso negado');
  expect(screen.queryByRole('button', { name: 'Nova tarefa' })).toBeNull();
  expect(
    transport.mock.calls.some(([p]) =>
      (typeof p === 'string' ? p : p instanceof URL ? p.href : p.url).includes('/tasks'),
    ),
  ).toBe(false);
});
it('task editing preserves version and sub-minute instants when dates are unchanged', async () => {
  const saved = vi.fn(),
    due = new Date(2026, 9, 8, 15, 30, 45, 123),
    task = { ...record, dueAt: due.toISOString() };
  const transport = setup((path, init) =>
    path === `tasks/${id}` && init?.method === 'PATCH'
      ? json({ ...task, version: 4 })
      : json({ data: [path.includes('branches') ? record.branch : record.owner], pageInfo }),
  );
  render(
    <Harness>
      <TaskForm record={task} onSaved={saved} />
    </Harness>,
  );
  const user = userEvent.setup();
  await screen.findByRole('combobox', { name: 'Responsável' });
  expect(screen.getByLabelText<HTMLInputElement>('Vencimento').value).toBe(
    localDateInput(due.toISOString()),
  );
  await user.click(screen.getByRole('button', { name: 'Salvar tarefa' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const body = transport.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body;
  if (typeof body !== 'string') throw new Error('Expected JSON task update');
  expect(JSON.parse(body) as unknown).toMatchObject({
    expectedVersion: 3,
    dueAt: due.toISOString(),
    target: null,
  });
});
it('task form rejects a reminder after its due time without sending an update', async () => {
  const task = {
    ...record,
    dueAt: new Date(2026, 9, 7, 10).toISOString(),
    remindAt: new Date(2026, 9, 7, 11).toISOString(),
  };
  const transport = setup();
  render(
    <Harness>
      <TaskForm record={task} onSaved={vi.fn()} />
    </Harness>,
  );
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Salvar tarefa' }));
  await screen.findByText(/lembrete exige vencimento/);
  expect(transport.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
});
it('timeline displays a dependency failure instead of an empty successful history', async () => {
  setup(() =>
    json(
      { status: 503, code: 'SERVICE_UNAVAILABLE', title: 'Unavailable', requestId: 'test' },
      503,
    ),
  );
  render(
    <Harness>
      <Timeline target={{ type: 'contact', id }} />
    </Harness>,
  );
  expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  expect(screen.queryByText('Nenhuma atividade registrada')).toBeNull();
});
it('notifications open a linked task and mark only the recipients item as read', async () => {
  const transport = setup((path, init) =>
    path === `notifications/${id}/read` && init?.method === 'POST'
      ? json({
          id,
          task: { id, name: record.name },
          readAt: dates.createdAt,
          createdAt: dates.createdAt,
        })
      : json({
          data: [{ id, task: { id, name: record.name }, readAt: null, createdAt: dates.createdAt }],
          pageInfo,
        }),
  );
  render(
    <Harness>
      <NotificationsInbox />
    </Harness>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Abrir notificações' }));
  expect(await screen.findByRole('link', { name: record.name })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Marcar como lida' }));
  await waitFor(() =>
    expect(
      transport.mock.calls.some(
        ([path, init]) =>
          (typeof path === 'string' ? path : path instanceof URL ? path.href : path.url).endsWith(
            `/notifications/${id}/read`,
          ) && init?.method === 'POST',
      ),
    ).toBe(true),
  );
});
