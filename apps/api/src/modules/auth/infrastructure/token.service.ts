import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, errors } from 'jose';
import { z } from 'zod';
import type { ApiConfig } from '@crm/config/server';
import { uuidSchema } from '@crm/contracts';
import { RUNTIME_CONFIG } from '../../runtime/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import type { Principal } from '../../../common/security.js';
const claims = z
  .object({
    sub: uuidSchema,
    sid: uuidSchema,
    cv: z.number().int().nonnegative(),
    iat: z.number().int(),
    exp: z.number().int(),
    iss: z.string(),
    aud: z.string(),
  })
  .strict();
export const newRefreshToken = () => randomBytes(32).toString('base64url');
export const refreshHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const validRefreshToken = (token: string) =>
  /^[A-Za-z0-9_-]{43}$/.test(token) &&
  Buffer.from(token, 'base64url').toString('base64url') === token;
export const unauthenticated = () =>
  new ApplicationError('UNAUTHENTICATED', 'Invalid credentials or session.');
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: ApiConfig) {
    this.key = Buffer.from(config.JWT_SECRET, 'base64url');
  }
  sign(principal: Principal) {
    return new SignJWT({ sid: principal.sessionId, cv: principal.contextVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(principal.userId)
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.config.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }
  async verify(token: string) {
    try {
      const result = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: this.config.JWT_ISSUER,
        audience: this.config.JWT_AUDIENCE,
        typ: 'JWT',
        requiredClaims: ['sub', 'sid', 'cv', 'iat', 'exp'],
        maxTokenAge: this.config.ACCESS_TOKEN_TTL_SECONDS,
      });
      const parsed = claims.safeParse(result.payload);
      if (
        !parsed.success ||
        parsed.data.exp - parsed.data.iat > this.config.ACCESS_TOKEN_TTL_SECONDS ||
        parsed.data.iat > Math.floor(Date.now() / 1000)
      )
        throw unauthenticated();
      return {
        userId: parsed.data.sub,
        sessionId: parsed.data.sid,
        contextVersion: parsed.data.cv,
      };
    } catch (error: unknown) {
      if (error instanceof errors.JOSEError) throw unauthenticated();
      throw error;
    }
  }
}
