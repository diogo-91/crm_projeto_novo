import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, it, expect, vi } from 'vitest';
import { BroadcastChannel as NativeBroadcastChannel } from 'node:worker_threads';
import type { ContactResponse } from '@crm/contracts';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/auth-provider';
import { CommercialQueryProvider } from '@/lib/commercial-query-provider';
import { LeadList } from './lead-list';
import { LeadForm } from './lead-form';
import { OpportunityForm } from './opportunity-form';
import { Kanban } from './kanban';
import { MoveForm } from './move-form';
import { optimisticStage, moveColumn } from './optimistic-move';
import type { OpportunityResponse, LeadResponse, PipelineResponse } from '@crm/contracts';
import { within } from '@testing-library/react';
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), params: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => '/leads',
  useSearchParams: () => new URLSearchParams(navigation.params),
}));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const branchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const dates = { createdAt: '2026-10-07T12:00:00.000Z', updatedAt: '2026-10-07T12:00:00.000Z' };
const contact: ContactResponse = {
  ...dates,
  id,
  name: 'Test contact',
  phone: '+442012345678',
  email: null,
  document: null,
  notes: null,
  source: 'MANUAL' as const,
  active: true,
  version: 1,
  branch: { id: branchId, name: 'Branch' },
  owner: { id, name: 'Owner' },
  company: null,
  tags: [],
};
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
    permissions: [
      'leads.read',
      'leads.create',
      'leads.update',
      'leads.convert',
      'pipelines.read',
      'pipelines.manage',
      'opportunities.read',
      'opportunities.create',
      'opportunities.update',
      'opportunities.move',
      'contacts.read',
      'contacts.create',
      'contacts.update',
      'companies.read',
      'companies.create',
      'tags.read',
    ],
  },
};
type Handler = (path: string, init: RequestInit | undefined) => Response | Promise<Response>;
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function setup(handler?: Handler, permissions = auth.context.permissions) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.test/api/v1');
  vi.stubGlobal('BroadcastChannel', NativeBroadcastChannel);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: <T,>(_: string, work: () => Promise<T>) => work() },
  });
  const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = (
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    ).replace('https://api.test/api/v1/', '');
    if (path === 'auth/refresh')
      return json({ ...auth, context: { ...auth.context, permissions } });
    if (handler) return handler(path, init);
    if (path.includes('assignment-branches'))
      return json({
        data: [{ id: branchId, name: 'Branch' }],
        pageInfo: { hasNextPage: false, nextCursor: null },
      });
    if (path.includes('assignment-owners'))
      return json({
        data: [{ id, name: 'Owner' }],
        pageInfo: { hasNextPage: false, nextCursor: null },
      });
    if (path.startsWith('pipelines/')) return json(pipeline);
    if (path.startsWith('pipelines?')) return json({ data: [pipeline], pageInfo });
    if (path.startsWith('opportunities?')) {
      const stage = new URLSearchParams(path.split('?')[1]).get('stageId');
      return json({ data: stage === entryId ? [deal] : [], pageInfo });
    }
    if (path.startsWith('contacts/')) return json(contact);
    return json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } });
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
  navigation.push.mockReset();
  navigation.replace.mockReset();
});

const pageInfo = { hasNextPage: false, nextCursor: null };
const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  wonId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  lostId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const pipeline: PipelineResponse = {
  ...dates,
  id,
  name: 'Sales',
  branch: null,
  active: true,
  version: 1,
  stages: [
    { id: entryId, name: 'Entry', kind: 'OPEN', position: 0, active: true },
    { id: wonId, name: 'Won', kind: 'WON', position: 10, active: true },
    { id: lostId, name: 'Lost', kind: 'LOST', position: 20, active: true },
  ],
};
const deal: OpportunityResponse = {
  ...dates,
  id,
  name: 'Test deal',
  branch: contact.branch,
  owner: contact.owner,
  notes: null,
  active: true,
  version: 1,
  contact: null,
  company: null,
  pipeline: { id, name: 'Sales' },
  stage:
    pipeline.stages[0] ??
    (() => {
      throw new Error('Entry missing');
    })(),
  status: 'OPEN',
  amount: '123.4500',
  currency: 'BRL',
  closedAt: null,
  lostReason: null,
};
const lead: LeadResponse = {
  ...dates,
  id,
  name: 'Test lead',
  branch: contact.branch,
  owner: contact.owner,
  notes: null,
  active: true,
  version: 1,
  contact: null,
  company: null,
  phone: contact.phone,
  email: null,
  companyName: null,
  source: 'MANUAL',
  status: 'NEW',
  convertedAt: null,
  opportunity: null,
};
function salesHandler(path: string): Response {
  if (path.startsWith('pipelines/')) return json(pipeline);
  if (path.startsWith('pipelines?')) return json({ data: [pipeline], pageInfo });
  if (path.startsWith('opportunities?'))
    return json({
      data: new URLSearchParams(path.split('?')[1]).get('stageId') === entryId ? [deal] : [],
      pageInfo,
    });
  if (path.includes('assignment-branches')) return json({ data: [contact.branch], pageInfo });
  if (path.includes('assignment-owners')) return json({ data: [contact.owner], pageInfo });
  return json({ data: [], pageInfo });
}
it('leads show useful empty state and permitted creation', async () => {
  setup();
  render(
    <Harness>
      <LeadList />
    </Harness>,
  );
  expect(await screen.findByText('Nenhum lead encontrado')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Novo lead' })).toBeTruthy();
});
it('viewer cannot create leads and denied users do not fetch private lists', async () => {
  const transport = setup(undefined, []);
  render(
    <Harness>
      <LeadList />
    </Harness>,
  );
  await screen.findByText('Acesso negado');
  expect(screen.queryByRole('button', { name: 'Novo lead' })).toBeNull();
  expect(
    transport.mock.calls.some(([path]) =>
      (typeof path === 'string' ? path : path instanceof URL ? path.href : path.url).includes(
        '/leads',
      ),
    ),
  ).toBe(false);
});
it('lead editing qualifies with expectedVersion and preserves hidden relations', async () => {
  const transport = setup(
    (path, init) =>
      path === 'leads/' + id && init?.method === 'PATCH'
        ? json({ ...lead, status: 'QUALIFIED', version: 2 })
        : salesHandler(path),
    ['leads.read', 'leads.update', 'pipelines.read'],
  );
  const user = userEvent.setup(),
    saved = vi.fn();
  render(
    <Harness>
      <LeadForm record={lead} onSaved={saved} />
    </Harness>,
  );
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Qualificação' }),
    'QUALIFIED',
  );
  await user.click(screen.getByRole('button', { name: 'Salvar lead' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = transport.mock.calls.find(([, init]) => init?.method === 'PATCH');
  const requestBody = call?.[1]?.body;
  if (typeof requestBody !== 'string') throw new Error('Expected JSON request body');
  const body: unknown = JSON.parse(requestBody);
  expect(body).toMatchObject({ status: 'QUALIFIED', expectedVersion: 1 });
  expect(body).not.toHaveProperty('companyId');
  expect(body).not.toHaveProperty('contactId');
});
it('opportunity editing sends decimal string and version without immutable pipeline fields', async () => {
  const transport = setup(
    (path, init) =>
      path === 'opportunities/' + id && init?.method === 'PATCH'
        ? json({ ...deal, version: 2 })
        : salesHandler(path),
    ['opportunities.read', 'opportunities.update', 'pipelines.read'],
  );
  const user = userEvent.setup(),
    saved = vi.fn();
  render(
    <Harness>
      <OpportunityForm record={deal} onSaved={saved} />
    </Harness>,
  );
  const value = await screen.findByRole('textbox', { name: 'Valor' });
  await user.clear(value);
  await user.type(value, '500.1234');
  await user.click(screen.getByRole('button', { name: 'Salvar oportunidade' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = transport.mock.calls.find(([, init]) => init?.method === 'PATCH');
  const requestBody = call?.[1]?.body;
  if (typeof requestBody !== 'string') throw new Error('Expected JSON request body');
  const body: unknown = JSON.parse(requestBody);
  expect(body).toMatchObject({ amount: '500.1234', expectedVersion: 1 });
  expect(body).not.toHaveProperty('pipelineId');
  expect(body).not.toHaveProperty('stageId');
});
it('loss movement requires a reason before invoking API', async () => {
  const transport = setup(salesHandler),
    user = userEvent.setup();
  render(
    <Harness>
      <MoveForm record={deal} selectedStage={lostId} onSaved={vi.fn()} />
    </Harness>,
  );
  await screen.findByRole('textbox', { name: 'Motivo da perda' });
  await user.click(screen.getByRole('button', { name: 'Confirmar movimentação' }));
  expect(await screen.findByText('Informe o motivo da perda.')).toBeTruthy();
  expect(
    transport.mock.calls.some(
      ([path, init]) =>
        (typeof path === 'string' ? path : path instanceof URL ? path.href : path.url).endsWith(
          `/opportunities/${id}/stage`,
        ) && init?.method === 'POST',
    ),
  ).toBe(false);
});
it('Kanban performs optimistic column movement and rolls back a server conflict', async () => {
  let reject: ((response: Response) => void) | undefined;
  setup((path, init) =>
    path === `opportunities/${id}/stage` && init?.method === 'POST'
      ? new Promise<Response>((resolve) => {
          reject = resolve;
        })
      : salesHandler(path),
  );
  const user = userEvent.setup();
  render(
    <Harness>
      <Kanban />
    </Harness>,
  );
  await screen.findByRole('button', { name: 'Mover Test deal' });
  await user.click(screen.getByRole('button', { name: 'Mover Test deal' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Nova etapa' }), wonId);
  await user.click(screen.getByRole('button', { name: 'Confirmar movimentação' }));
  await waitFor(() =>
    expect(
      within(screen.getByLabelText('Etapa Won')).getByText('Test deal', { exact: true }),
    ).toBeTruthy(),
  );
  expect(
    within(screen.getByLabelText('Etapa Entry')).queryByText('Test deal', { exact: true }),
  ).toBeNull();
  if (!reject) throw new Error('Movement was not dispatched');
  reject(
    json({ status: 409, code: 'RESOURCE_CONFLICT', title: 'Conflict', requestId: 'test' }, 409),
  );
  await screen.findByText(/Já existe um registro/);
  await waitFor(() =>
    expect(
      within(screen.getByLabelText('Etapa Entry')).getByText('Test deal', { exact: true }),
    ).toBeTruthy(),
  );
  expect(
    within(screen.getByLabelText('Etapa Won')).queryByText('Test deal', { exact: true }),
  ).toBeNull();
});
it('optimistic column update keeps page cursors and removes duplicate cards', () => {
  const stage = pipeline.stages[1];
  if (!stage) throw new Error('Won missing');
  const optimistic = optimisticStage(deal, stage, { stageId: stage.id, expectedVersion: 1 });
  const data = {
    pages: [{ data: [deal], pageInfo: { hasNextPage: true, nextCursor: 'safe-cursor' } }],
    pageParams: [''],
  };
  const moved = moveColumn(data, optimistic, true);
  expect(moved.pages[0]?.data).toHaveLength(1);
  expect(moved.pages[0]?.data[0]?.status).toBe('WON');
  expect(moved.pages[0]?.pageInfo.nextCursor).toBe('safe-cursor');
});
