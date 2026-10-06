import { describe, it, expect, vi } from 'vitest';
import { authResponseSchema, meResponseSchema } from '@crm/contracts';
import { ApiClient, ApiError } from '@/lib/api-client';
import { SessionClient } from './session-client';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const membershipId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const organizationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const auth = {
  user: {
    id: userId,
    name: 'Test',
    email: 'test@example.test',
    active: true,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
  },
  memberships: [{ membershipId, organizationId, organizationName: 'A' }],
  context: {
    membershipId,
    organizationId,
    organizationName: 'A',
    primaryBranchId: null,
    branches: [],
    roles: [],
    permissions: ['users.read'],
  },
  accessToken: 'token-1',
  expiresIn: 900,
  sessionExpiresAt: '2026-11-01T00:00:00.000Z',
};
const valid = authResponseSchema.parse(auth);
const me = { user: valid.user, memberships: valid.memberships, context: valid.context };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}
function reply(body: unknown, status = 200) {
  return Promise.resolve(json(body, status));
}
function create(transport: typeof fetch) {
  const publish = vi.fn();
  const session = new SessionClient(new ApiClient('https://api.test/api/v1', transport), (work) =>
    work(),
  );
  session.subscribeEvents(publish);
  return { session, publish };
}
describe('session owner', () => {
  it('restores single-flight, including Strict Mode duplicate effects', async () => {
    const transport = vi.fn<typeof fetch>(() => reply(valid));
    const { session } = create(transport);
    await Promise.all([session.restore(), session.restore(), session.restore()]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().status).toBe('authenticated');
  });
  it('refreshes once for concurrent 401s and retries each request', async () => {
    let generation = 0;
    let calls = 0;
    const transport = vi.fn<typeof fetch>((path, init) => {
      if (requestUrl(path).endsWith('auth/refresh'))
        return reply({ ...valid, accessToken: `t${++generation}` });
      calls++;
      return new Headers(init?.headers).get('Authorization') === 'Bearer t1'
        ? reply({}, 401)
        : reply(me);
    });
    const { session } = create(transport);
    await session.restore();
    await Promise.all([
      session.request('auth/me', meResponseSchema),
      session.request('auth/me', meResponseSchema),
    ]);
    expect(generation).toBe(2);
    expect(calls).toBe(4);
  });
  it('does not loop when the retried request also returns 401', async () => {
    const transport = vi.fn<typeof fetch>((path) =>
      requestUrl(path).endsWith('refresh') ? reply(valid) : reply({}, 401),
    );
    const { session } = create(transport);
    await session.restore();
    await expect(session.request('auth/me', meResponseSchema)).rejects.toMatchObject({
      status: 401,
    });
    expect(transport).toHaveBeenCalledTimes(4);
    expect(session.getSnapshot().status).toBe('anonymous');
  });
  it('handles expired in-memory access before sending a request', async () => {
    const transport = vi.fn<typeof fetch>((path) =>
      requestUrl(path).endsWith('refresh') ? reply(valid) : reply(me),
    );
    const { session } = create(transport);
    await session.restore();
    const time = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 901000);
    try {
      await session.request('auth/me', meResponseSchema);
      expect(transport).toHaveBeenCalledTimes(3);
    } finally {
      time.mockRestore();
    }
  });
  it('fails closed with visible error state when refresh infrastructure fails', async () => {
    const { session } = create(() => reply({}, 503));
    await expect(session.restore()).rejects.toMatchObject({ status: 503 });
    expect(session.getSnapshot()).toMatchObject({ status: 'error', me: null });
  });
  it('ends authentication on revoked refresh without fallback', async () => {
    const { session } = create(() => reply({}, 401));
    await expect(session.restore()).rejects.toMatchObject({ status: 401 });
    expect(session.getSnapshot().status).toBe('anonymous');
  });
  it('switches to the exact backend context and replaces credentials', async () => {
    const next = {
      ...valid,
      context: { ...valid.context, organizationName: 'B' },
      accessToken: 'new-context',
    };
    const transport = vi.fn<typeof fetch>((path) =>
      requestUrl(path).endsWith('context') ? reply(next) : reply(valid),
    );
    const { session, publish } = create(transport);
    await session.restore();
    await session.selectOrganization(organizationId);
    expect(session.getSnapshot().me?.context?.organizationName).toBe('B');
    expect(publish).toHaveBeenCalledWith('changed');
    expect(transport.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ organizationId }));
  });
  it('rejects stale responses after an organization switch', async () => {
    let release: ((value: Response) => void) | undefined;
    const transport: typeof fetch = (path) =>
      requestUrl(path).endsWith('me')
        ? new Promise((resolve) => {
            release = resolve;
          })
        : reply(valid);
    const { session } = create(transport);
    await session.restore();
    const request = session.request('auth/me', meResponseSchema);
    await session.selectOrganization(organizationId);
    release?.(json(me));
    await expect(request).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
  });
  it('revokes through backend before reporting logout success', async () => {
    const transport = vi.fn<typeof fetch>((path) =>
      requestUrl(path).endsWith('logout')
        ? Promise.resolve(new Response(null, { status: 204 }))
        : reply(valid),
    );
    const { session, publish } = create(transport);
    await session.restore();
    await session.logout();
    expect(transport.mock.calls[1]?.[0]).toContain('auth/logout');
    expect(session.getSnapshot().me).toBeNull();
    expect(publish).toHaveBeenCalledWith('logout');
  });
  it('does not report logout success when the server fails', async () => {
    const { session, publish } = create((path) =>
      requestUrl(path).endsWith('logout') ? reply({}, 503) : reply(valid),
    );
    await session.restore();
    await expect(session.logout()).rejects.toMatchObject({ status: 503 });
    expect(publish).not.toHaveBeenCalled();
    expect(session.getSnapshot().status).toBe('error');
  });
  it('clears all identity/context on cross-tab logout', async () => {
    const { session } = create(() => reply(valid));
    await session.restore();
    session.external('logout');
    expect(session.getSnapshot()).toEqual({ status: 'anonymous', me: null, error: null });
  });
  it('publishes identity change only after valid real login response', async () => {
    const { session, publish } = create(() => reply(valid));
    await session.login({ email: 'test@example.test', password: 'password' });
    expect(publish).toHaveBeenCalledWith('changed');
  });
  it('validates transport responses without exposing payload details', async () => {
    const { session } = create(() => reply({ accessToken: 'invalid' }));
    await expect(session.restore()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(session.getSnapshot().me).toBeNull();
  });
  it('propagates failed login and permits subsequent valid login', async () => {
    let attempt = 0;
    const { session } = create(async () => (++attempt === 1 ? reply({}, 401) : reply(valid)));
    await expect(
      session.login({ email: 'test@example.test', password: 'bad' }),
    ).rejects.toBeInstanceOf(ApiError);
    await session.login({ email: 'test@example.test', password: 'good' });
    expect(session.getSnapshot().status).toBe('authenticated');
  });
});
it('discards the original request when refresh observes a different membership', async () => {
  let generation = 0;
  const transport: typeof fetch = (path) => {
    if (requestUrl(path).endsWith('refresh'))
      return reply(
        ++generation === 1
          ? valid
          : {
              ...valid,
              context: { ...valid.context, membershipId: userId, organizationName: 'B' },
            },
      );
    return reply({}, 401);
  };
  const { session } = create(transport);
  await session.restore();
  await expect(session.request('auth/me', meResponseSchema)).rejects.toMatchObject({
    code: 'STALE_CONTEXT',
  });
  expect(session.getSnapshot().me?.context?.organizationName).toBe('B');
});
it('does not restore a refresh response overtaken by cross-tab logout', async () => {
  let release: ((value: Response) => void) | undefined;
  const { session } = create(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const restore = session.restore();
  await Promise.resolve();
  await Promise.resolve();
  session.external('logout');
  release?.(json(valid));
  await restore;
  expect(session.getSnapshot().status).toBe('anonymous');
  expect(session.getSnapshot().me).toBeNull();
});
it('does not replace a new context with a stale focus-check failure', async () => {
  let reject: ((error: Error) => void) | undefined;
  const transport: typeof fetch = (path) =>
    requestUrl(path).endsWith('me')
      ? new Promise((_, fail) => {
          reject = fail;
        })
      : reply({ ...valid, context: { ...valid.context, organizationName: 'B' } });
  const { session } = create(transport);
  await session.restore();
  const check = session.check();
  await session.selectOrganization(organizationId);
  reject?.(new Error('aborted old request'));
  await check;
  expect(session.getSnapshot().status).toBe('authenticated');
  expect(session.getSnapshot().me?.context?.organizationName).toBe('B');
});
