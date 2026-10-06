import { randomBytes, randomUUID } from 'node:crypto';
import { decodeJwt, SignJWT } from 'jose';
import { expect, it } from 'vitest';
import { parseApiEnvironment } from '@crm/config/server';
import { TokenService, newRefreshToken, refreshHash, validRefreshToken } from './token.service.js';
const config = parseApiEnvironment({
  NODE_ENV: 'test',
  API_PORT: 3001,
  DATABASE_URL: 'postgresql://synthetic@localhost/test',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  CORS_ORIGINS: 'http://localhost:3000',
  JWT_SECRET: randomBytes(32).toString('base64url'),
});
const tokens = new TokenService(config);
it('signs and verifies minimal identity/session claims with bounded expiry', async () => {
  const principal = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    membershipId: null,
    contextVersion: 2,
  };
  const token = await tokens.sign(principal);
  expect(await tokens.verify(token)).toEqual({
    userId: principal.userId,
    sessionId: principal.sessionId,
    contextVersion: 2,
  });
  const claims = decodeJwt(token);
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number')
    throw new Error('JWT times absent');
  expect(claims.exp - claims.iat).toBe(900);
  expect(claims).not.toHaveProperty('organizationId');
});
it('rejects malformed access token and unexpected claims even with valid signature', async () => {
  await expect(tokens.verify('invalid')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  const token = await new SignJWT({ sid: randomUUID(), cv: 0, role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(randomUUID())
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(Buffer.from(config.JWT_SECRET, 'base64url'));
  await expect(tokens.verify(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
});
it('refresh is opaque, nonrecoverable by hash and rejects malformed encoding', () => {
  const one = newRefreshToken();
  const two = newRefreshToken();
  expect(one).not.toBe(two);
  expect(validRefreshToken(one)).toBe(true);
  expect(refreshHash(one)).toMatch(/^[a-f0-9]{64}$/);
  expect(refreshHash(one)).not.toContain(one);
  expect(validRefreshToken('invalid')).toBe(false);
  expect(validRefreshToken(one + '=')).toBe(false);
});
