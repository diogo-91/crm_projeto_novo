import { expect, it } from 'vitest';
import { parseWebEnvironment } from './web.js';
it('requires a valid HTTP API URL', () => {
  expect(() => parseWebEnvironment({})).toThrow('NEXT_PUBLIC_API_URL');
  expect(() => parseWebEnvironment({ NEXT_PUBLIC_API_URL: 'file:///etc/passwd' })).toThrow();
});
it('does not export server secrets', () =>
  expect(
    parseWebEnvironment({
      NEXT_PUBLIC_API_URL: 'https://example.com/api/v1',
      DATABASE_URL: 'private',
    }),
  ).toEqual({ NEXT_PUBLIC_API_URL: 'https://example.com/api/v1' }));
