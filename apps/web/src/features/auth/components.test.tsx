import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { BroadcastChannel as NativeBroadcastChannel } from 'node:worker_threads';
import { setImmediate as nextEventTurn } from 'node:timers/promises';
import { TooltipProvider } from '@crm/ui';
import { AuthProvider, Can } from './auth-provider';
import { LoginForm } from './login-form';
import { ProtectedApp } from './protected-app';
import { OrganizationSwitcher } from './organization-switcher';
import { Sidebar } from '@/components/navigation/sidebar';
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/contacts' }));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const response = {
  accessToken: 'memory-only',
  expiresIn: 900,
  sessionExpiresAt: '2026-11-01T00:00:00.000Z',
  user: {
    id,
    name: 'Pessoa',
    email: 'person@example.test',
    active: true,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
  },
  memberships: [
    { membershipId: id, organizationId: id, organizationName: 'A' },
    { membershipId: other, organizationId: other, organizationName: 'B' },
  ],
  context: {
    organizationId: id,
    organizationName: 'A',
    membershipId: id,
    primaryBranchId: null,
    branches: [],
    roles: [],
    cacheScopeKey: 'a'.repeat(64),
    permissions: ['users.read'],
  },
};
function setup(body: unknown, status = 200) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.test/api/v1');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
  vi.stubGlobal('BroadcastChannel', NativeBroadcastChannel);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: <T,>(_: string, work: () => Promise<T>) => work() },
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  router.replace.mockReset();
});
it('validates login fields accessibly before contacting the login endpoint', async () => {
  setup({}, 401);
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>,
  );
  const submit = await screen.findByRole('button', { name: 'Entrar no seu espaço' });
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
  await user.click(submit);
  expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'E-mail' }).getAttribute('aria-invalid')).toBe('true');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('redirects guests and never mounts the protected content', async () => {
  setup({}, 401);
  render(
    <AuthProvider>
      <ProtectedApp>
        <p>Private content</p>
      </ProtectedApp>
    </AuthProvider>,
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  expect(screen.queryByText('Private content')).toBeNull();
});
it('shows infrastructure error rather than admitting a guest or looping refresh', async () => {
  setup({}, 503);
  render(
    <AuthProvider>
      <ProtectedApp>
        <p>Private content</p>
      </ProtectedApp>
    </AuthProvider>,
  );
  expect(await screen.findByText(/serviço está indisponível/)).toBeTruthy();
  expect(screen.queryByText('Private content')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('uses only backend capabilities for Can hints', async () => {
  setup(response);
  render(
    <AuthProvider>
      <Can permission="users.read">
        <p>Read hint</p>
      </Can>
      <Can permission="users.manage">
        <p>Manage hint</p>
      </Can>
    </AuthProvider>,
  );
  expect(await screen.findByText('Read hint')).toBeTruthy();
  expect(screen.queryByText('Manage hint')).toBeNull();
});
it('renders organization choices from backend memberships', async () => {
  setup(response);
  render(
    <AuthProvider>
      <OrganizationSwitcher />
    </AuthProvider>,
  );
  const select = await screen.findByRole('combobox', { name: 'Organização atual' });
  expect(select.querySelectorAll('option')).toHaveLength(2);
  expect((select as HTMLSelectElement).value).toBe(id);
});
it('marks active navigation and calls mobile close only after navigation', async () => {
  const close = vi.fn();
  render(
    <TooltipProvider>
      <Sidebar onNavigate={close} />
    </TooltipProvider>,
  );
  const link = screen.getByRole('link', { name: 'Clientes' });
  expect(link.getAttribute('aria-current')).toBe('page');
  // DOM unit test checks the callback; real navigation is covered by Playwright.
  link.addEventListener('click', (event) => event.preventDefault());
  await userEvent.click(link);
  expect(close).toHaveBeenCalledOnce();
});
it('provides accessible labels for collapsed links', () => {
  render(
    <TooltipProvider>
      <Sidebar collapsed />
    </TooltipProvider>,
  );
  expect(screen.getByRole('link', { name: 'Clientes' }).getAttribute('aria-label')).toBe(
    'Clientes',
  );
});

it('notifies other tabs without refreshing or clearing its own accepted context', async () => {
  setup(response);
  const changed = {
    ...response,
    context: {
      ...response.context,
      organizationId: other,
      organizationName: 'B',
      membershipId: other,
    },
  };
  vi.mocked(fetch).mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(
      new Response(JSON.stringify(url.endsWith('auth/context') ? changed : response)),
    );
  });
  const foreign = new NativeBroadcastChannel('crm-session');
  try {
    const message = new Promise<unknown>((resolve) => {
      foreign.onmessage = (event) => resolve(event.data);
    });
    render(
      <AuthProvider>
        <OrganizationSwitcher />
      </AuthProvider>,
    );
    const select = await screen.findByRole('combobox', { name: 'Organização atual' });
    await userEvent.selectOptions(select, other);
    expect(await message).toBe('changed');
    await nextEventTurn();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(other);
  } finally {
    foreign.close();
  }
});

it('receives logout from another tab and removes protected content', async () => {
  setup(response);
  const foreign = new NativeBroadcastChannel('crm-session');
  try {
    render(
      <AuthProvider>
        <ProtectedApp>
          <p>Private content</p>
        </ProtectedApp>
      </AuthProvider>,
    );
    expect(await screen.findByText('Private content')).toBeTruthy();
    foreign.postMessage('logout');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Private content')).toBeNull();
  } finally {
    foreign.close();
  }
});
