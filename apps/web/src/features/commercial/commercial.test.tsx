import { ProductList } from '@/features/catalog/product-list';
import { QuoteList } from '@/features/quotes/quote-list';
import { QuoteDetail } from '@/features/quotes/quote-detail';
import { ProductForm } from '@/features/catalog/product-form';
import { PriceListCreateForm } from '@/features/catalog/price-list-form';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, it, expect, vi } from 'vitest';
import { BroadcastChannel as NativeBroadcastChannel } from 'node:worker_threads';
import type { ContactResponse } from '@crm/contracts';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/auth-provider';
import { CommercialQueryProvider } from '@/lib/commercial-query-provider';
import { ContactList } from '@/features/contacts/contact-list';
import { ContactForm } from '@/features/contacts/contact-form';
import { ContactDetail } from '@/features/contacts/contact-detail';
import { CompanyForm } from '@/features/companies/company-form';
import { QueryError } from './query-feedback';
import { commercialKeys } from './queries';
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), params: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => '/contacts',
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

const quote = {
  ...dates,
  id,
  rootQuoteId: id,
  previousQuoteId: null,
  revision: 1,
  name: 'Test proposal',
  branchId,
  ownerMembershipId: id,
  opportunityId: null,
  currency: 'BRL',
  status: 'DRAFT',
  subtotal: '20.00',
  discount: '2.00',
  total: '18.00',
  version: 1,
  contactId: id,
  companyId: null,
  buyer: { name: 'Preserved buyer', document: null, email: null, phone: null },
  priceListId: id,
  priceListName: 'Snapshot list',
  validUntil: null,
  notes: null,
  approvedAt: null,
  items: [
    {
      productId: id,
      sku: 'ITEM',
      description: 'Preserved description',
      unit: 'UN',
      quantity: '2.000000',
      unitPrice: '10.000000',
      discountPercent: '10.00',
      subtotal: '20.00',
      discount: '2.00',
      total: '18.00',
    },
  ],
  canUpdate: false,
  canApprove: false,
  canRevise: false,
};
it('quote list respects read-only UI actions and shows exact server totals', async () => {
  setup(
    (path) =>
      path.startsWith('quotes?')
        ? json({
            data: [
              {
                ...Object.fromEntries(
                  Object.entries(quote).filter(
                    ([key]) =>
                      ![
                        'contactId',
                        'companyId',
                        'buyer',
                        'priceListId',
                        'priceListName',
                        'validUntil',
                        'notes',
                        'approvedAt',
                        'items',
                        'canUpdate',
                        'canApprove',
                        'canRevise',
                      ].includes(key),
                  ),
                ),
              },
            ],
            pageInfo: { hasNextPage: false, nextCursor: null },
          })
        : json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    ['quotes.read'],
  );
  render(
    <Harness>
      <QuoteList />
    </Harness>,
  );
  expect(await screen.findByRole('link', { name: 'Test proposal' })).toBeTruthy();
  expect(screen.getByText(/BRL 18.00/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Novo orçamento' })).toBeNull();
});
it('quote page denies unauthorized access without contacting quote resources', async () => {
  const transport = setup(undefined, []);
  render(
    <Harness>
      <QuoteList />
    </Harness>,
  );
  await screen.findByText('Acesso negado');
  expect(
    transport.mock.calls.filter(([input]) =>
      (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes(
        '/quotes',
      ),
    ),
  ).toHaveLength(0);
});
it('quote detail presents preserved snapshots without forbidden approval controls', async () => {
  setup(
    (path) =>
      path.includes('/history')
        ? json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } })
        : json(quote),
    ['quotes.read'],
  );
  render(
    <Harness>
      <QuoteDetail id={id} />
    </Harness>,
  );
  expect(await screen.findByText('Preserved buyer')).toBeTruthy();
  expect(screen.getByText('ITEM · Preserved description')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Aprovar orçamento' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Editar orçamento' })).toBeNull();
});
it('quote revision retries retain the same idempotency key and expose infrastructure failure', async () => {
  const attempts: RequestInit[] = [];
  setup(
    (path, init) => {
      if (path.includes('/revisions')) {
        attempts.push(init ?? {});
        return attempts.length === 1
          ? json(
              {
                type: 'about:blank',
                title: 'Unavailable',
                status: 503,
                detail: 'Dependency unavailable',
                instance: '/quotes',
                code: 'DEPENDENCY_UNAVAILABLE',
                requestId: id,
              },
              503,
            )
          : json({ ...quote, id: branchId, rootQuoteId: id, previousQuoteId: id, revision: 2 });
      }
      return path.includes('/history')
        ? json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } })
        : json({
            ...quote,
            status: 'APPROVED',
            version: 2,
            approvedAt: dates.createdAt,
            canRevise: true,
          });
    },
    ['quotes.read', 'quotes.create'],
  );
  render(
    <Harness>
      <QuoteDetail id={id} />
    </Harness>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Criar revisão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar revisão' }));
  await screen.findByText('O serviço está indisponível no momento. Tente novamente em instantes.');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar revisão' }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/quotes/${branchId}`));
  expect(attempts).toHaveLength(2);
  expect(new Headers(attempts[0]?.headers).get('Idempotency-Key')).toBe(
    new Headers(attempts[1]?.headers).get('Idempotency-Key'),
  );
  expect(new Headers(attempts[0]?.headers).get('Idempotency-Key')).toMatch(/^[a-f0-9-]{36}$/);
});
it('shows the empty state and a permitted create action', async () => {
  setup();
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  expect(await screen.findByText('Nenhum cliente encontrado')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Novo cliente' })).toBeTruthy();
});
it('hides create action for read-only permissions', async () => {
  setup(undefined, ['contacts.read']);
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  await screen.findByText('Nenhum cliente encontrado');
  expect(screen.queryByRole('button', { name: 'Novo cliente' })).toBeNull();
});
it('denies the page without contacting the commercial endpoint', async () => {
  const transport = setup(undefined, []);
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  await screen.findByText('Acesso negado');
  expect(
    transport.mock.calls.filter(([input]) =>
      (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes(
        '/contacts?',
      ),
    ),
  ).toHaveLength(0);
});
it('renders authorized rows and preserves cursor pagination in URL', async () => {
  setup(
    () => json({ data: [contact], pageInfo: { hasNextPage: true, nextCursor: 'opaque' } }),
    ['contacts.read'],
  );
  const user = userEvent.setup();
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  await screen.findAllByText('Test contact');
  await user.click(screen.getByRole('button', { name: 'Próxima' }));
  expect(navigation.push).toHaveBeenCalledWith('/contacts?previous=&cursor=opaque', {
    scroll: false,
  });
});
it('debounces search into a scoped URL instead of requesting on every keystroke', async () => {
  setup(undefined, ['contacts.read']);
  const user = userEvent.setup();
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  await screen.findByText('Nenhum cliente encontrado');
  await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'Alice');
  await waitFor(() =>
    expect(navigation.replace).toHaveBeenCalledWith('/contacts?search=Alice', { scroll: false }),
  );
  expect(navigation.replace).toHaveBeenCalledTimes(1);
});
it('loading remains explicit until a real response settles', async () => {
  let finish: ((response: Response) => void) | undefined;
  setup(
    (path) =>
      path.startsWith('contacts?')
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    ['contacts.read'],
  );
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  expect(await screen.findByRole('status', { name: 'Carregando registros' })).toBeTruthy();
  if (!finish) throw new Error('Request not started');
  finish(json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } }));
  expect(await screen.findByText('Nenhum cliente encontrado')).toBeTruthy();
});
it('list errors offer retry without stale private data', async () => {
  let fail = true;
  setup(
    (path) =>
      fail && path.startsWith('contacts?')
        ? json({ status: 503, code: 'UNAVAILABLE', title: 'Unavailable' }, 503)
        : json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    ['contacts.read'],
  );
  const user = userEvent.setup();
  render(
    <Harness>
      <ContactList />
    </Harness>,
  );
  await screen.findByText('Não foi possível carregar');
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('Nenhum cliente encontrado');
});
it('contact form validates required fields before sending a mutation', async () => {
  const transport = setup();
  const user = userEvent.setup();
  render(
    <Harness>
      <ContactForm onSaved={vi.fn()} />
    </Harness>,
  );
  await screen.findByRole('button', { name: 'Salvar cliente' });
  await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
  expect(await screen.findByText('Informe o nome.')).toBeTruthy();
  expect(
    transport.mock.calls.filter(
      ([input, init]) =>
        (typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
        ).endsWith('/contacts') && init?.method === 'POST',
    ),
  ).toHaveLength(0);
});
it('contact form reports safe duplicate feedback and preserves input', async () => {
  const saved = vi.fn();
  setup((path) => {
    if (path === 'contacts')
      return json({ status: 409, code: 'RESOURCE_CONFLICT', title: 'Conflict' }, 409);
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
    return json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } });
  });
  const user = userEvent.setup();
  render(
    <Harness>
      <ContactForm onSaved={saved} />
    </Harness>,
  );
  await user.type(await screen.findByRole('textbox', { name: 'Nome' }), 'New client');
  await user.type(screen.getByRole('textbox', { name: 'Telefone' }), '+442012345678');
  await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('Já existe'),
  );
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Nome' }).value).toBe('New client');
  expect(saved).not.toHaveBeenCalled();
});
it('editing preserves hidden relationships and does not send absent creation defaults', async () => {
  const transport = setup(
    (path) =>
      path === 'contacts/' + id
        ? json(contact)
        : json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    ['contacts.read', 'contacts.update'],
  );
  const user = userEvent.setup();
  render(
    <Harness>
      <ContactForm record={contact} onSaved={vi.fn()} />
    </Harness>,
  );
  const name = await screen.findByRole('textbox', { name: 'Nome' });
  await user.clear(name);
  await user.type(name, 'Edited');
  await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
  await waitFor(() =>
    expect(transport.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true),
  );
  const init = transport.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1];
  if (typeof init?.body !== 'string') throw new Error('Mutation body missing');
  const payload: unknown = JSON.parse(init.body) as unknown;
  expect(payload).toHaveProperty('expectedVersion', 1);
  expect(payload).not.toHaveProperty('companyId');
  expect(payload).not.toHaveProperty('tagIds');
});
it('company form allows optional contact details but requires a name', async () => {
  setup();
  const user = userEvent.setup();
  render(
    <Harness>
      <CompanyForm onSaved={vi.fn()} />
    </Harness>,
  );
  await user.click(await screen.findByRole('button', { name: 'Salvar empresa' }));
  expect(await screen.findByText('Informe o nome.')).toBeTruthy();
});
it('detail shows only safe returned metadata and literal notes', async () => {
  setup(undefined, ['contacts.read']);
  render(
    <Harness>
      <ContactDetail id={id} />
    </Harness>,
  );
  expect(await screen.findByRole('heading', { name: 'Test contact' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Editar cliente' })).toBeNull();
  expect(screen.getByText('Branch')).toBeTruthy();
});
it('query keys always separate organizations and memberships', () => {
  expect(commercialKeys.detail('A', 'one', 'scope', 'contacts', id)).not.toEqual(
    commercialKeys.detail('B', 'one', 'scope', 'contacts', id),
  );
  expect(commercialKeys.detail('A', 'one', 'scope', 'contacts', id)).not.toEqual(
    commercialKeys.detail('A', 'two', 'scope', 'contacts', id),
  );
});
it('query failure messages do not expose technical errors', () => {
  render(<QueryError error={new Error('Prisma P2002 passwordHash internal')} retry={vi.fn()} />);
  expect(screen.queryByText(/P2002/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
});

it('catalog read-only renders products without a management action', async () => {
  setup(
    () => json({ data: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    ['products.read'],
  );
  render(
    <Harness>
      <ProductList />
    </Harness>,
  );
  await screen.findByText('Nenhum registro encontrado');
  expect(screen.queryByRole('button', { name: 'Novo produto' })).toBeNull();
});
it('catalog denied state does not request product data', async () => {
  const transport = setup(undefined, []);
  render(
    <Harness>
      <ProductList />
    </Harness>,
  );
  await screen.findByText('Acesso negado');
  expect(
    transport.mock.calls.filter(([input]) =>
      (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes(
        '/products?',
      ),
    ),
  ).toHaveLength(0);
});
it('product form normalizes SKU and sends an explicit validated contract', async () => {
  const transport = setup(
    () =>
      json({
        id,
        name: 'Product',
        sku: 'SKU-1',
        unit: 'UN',
        description: null,
        active: true,
        version: 1,
        ...dates,
      }),
    ['products.read', 'products.manage'],
  );
  const user = userEvent.setup();
  const saved = vi.fn();
  render(
    <Harness>
      <ProductForm onSaved={saved} />
    </Harness>,
  );
  await user.type(await screen.findByRole('textbox', { name: 'Nome do produto' }), 'Product');
  await user.type(screen.getByRole('textbox', { name: 'SKU' }), ' sku-1 ');
  await user.click(screen.getByRole('button', { name: 'Salvar produto' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = transport.mock.calls.find(
    ([input, init]) =>
      (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith(
        '/products',
      ) && init?.method === 'POST',
  );
  expect(call).toBeDefined();
  const payload = call?.[1]?.body;
  if (typeof payload !== 'string') throw new Error('Expected JSON request body');
  expect(JSON.parse(payload) as unknown).toEqual({
    name: 'Product',
    sku: 'SKU-1',
    unit: 'UN',
    description: null,
  });
});
it('branch-only price management requires an authorized branch and never enables an organizational list implicitly', async () => {
  setup(
    () =>
      json({
        data: [{ id: branchId, name: 'Branch' }],
        pageInfo: { hasNextPage: false, nextCursor: null },
        organizationAllowed: false,
      }),
    ['price-lists.manage'],
  );
  const user = userEvent.setup();
  render(
    <Harness>
      <PriceListCreateForm onSaved={vi.fn()} />
    </Harness>,
  );
  const select = await screen.findByRole('combobox', { name: 'Disponível para' });
  await waitFor(() => expect(select).toHaveProperty('disabled', false));
  expect(screen.getByRole('button', { name: 'Salvar tabela' })).toHaveProperty('disabled', true);
  await user.selectOptions(select, branchId);
  expect(screen.getByRole('button', { name: 'Salvar tabela' })).toHaveProperty('disabled', false);
});
