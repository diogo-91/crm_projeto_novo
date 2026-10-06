import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient, ApiError, errorMessage } from './api-client';
function reply(body: BodyInit | null, init?: ResponseInit) {
  return Promise.resolve(new Response(body, init));
}
it('sends credentials, no-store and request ID through the central transport', async () => {
  const transport = vi.fn<typeof fetch>(() => reply('{"ok":true}'));
  const api = new ApiClient('https://api.test/', transport);
  await api.parsed('/health', z.object({ ok: z.boolean() }));
  const init = transport.mock.calls[0]?.[1];
  expect(init?.credentials).toBe('include');
  expect(init?.cache).toBe('no-store');
  expect(new Headers(init?.headers).get('X-Request-Id')).toMatch(/^[\da-f-]{36}$/);
});
it('maps safe problem metadata while withholding raw server detail', async () => {
  const api = new ApiClient('https://api.test', () =>
    reply(
      JSON.stringify({
        type: 'about:blank',
        title: 'Error',
        status: 409,
        code: 'CONFLICT',
        detail: 'private database message',
      }),
      { status: 409 },
    ),
  );
  await expect(api.send('x')).rejects.toMatchObject({
    status: 409,
    code: 'CONFLICT',
    message: 'API request failed',
  });
});
it('maps non-JSON HTTP failure without hiding its status', async () => {
  const api = new ApiClient('https://api.test', () => reply('gateway', { status: 503 }));
  await expect(api.send('x')).rejects.toMatchObject({ status: 503 });
});
it('distinguishes network failures', async () => {
  const api = new ApiClient('https://api.test', () => Promise.reject(new TypeError('network')));
  await expect(api.send('x')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
});
it('rejects invalid successful JSON instead of accepting corrupted contracts', async () => {
  const api = new ApiClient('https://api.test', () => reply('not-json'));
  await expect(api.send('x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('supports 204 without inventing a response body', async () => {
  const api = new ApiClient('https://api.test', () => reply(null, { status: 204 }));
  expect(await api.send('x')).toBeUndefined();
});
it('uses friendly messages for login, limits and session expiration', () => {
  expect(errorMessage(new ApiError(401, 'X'), true)).toBe('Credenciais inválidas.');
  expect(errorMessage(new ApiError(429, 'X'))).toContain('Muitas tentativas');
  expect(errorMessage(new ApiError(401, 'X'))).toContain('sessão expirou');
});

it('preserves headers supplied as a native Headers instance', async () => {
  const transport = vi.fn<typeof fetch>(() => reply('{}'));
  const api = new ApiClient('https://api.test', transport);
  await api.send('x', { headers: new Headers({ 'X-Custom': 'value' }) });
  expect(new Headers(transport.mock.calls[0]?.[1]?.headers).get('X-Custom')).toBe('value');
});

it('calls native-compatible fetch without a foreign receiver', async () => {
  function transport(this: unknown) {
    expect(this).toBeUndefined();
    return reply('{}');
  }
  await new ApiClient('https://api.test', transport).send('x');
});
