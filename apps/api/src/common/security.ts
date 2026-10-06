import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PermissionCode } from '@crm/contracts';
import type { TenantContext } from '../modules/access-control/index.js';
export type Principal = {
  userId: string;
  sessionId: string;
  membershipId: string | null;
  contextVersion: number;
};
export type SecurityRequest = Request & { principal?: Principal; tenant?: TenantContext };
export const COOKIE_FLOW = Symbol('cookie-flow');
export const CookieFlow = (kind: 'login' | 'refresh' | 'logout') => SetMetadata(COOKIE_FLOW, kind);
export const PUBLIC = Symbol('public');
export const IDENTITY = Symbol('identity');
export const PERMISSION = Symbol('permission');
export type Requirement = {
  permission: PermissionCode;
  target: 'organization' | 'collection' | 'platform';
};
export const PublicEndpoint = () => SetMetadata(PUBLIC, true);
export const IdentityEndpoint = () => SetMetadata(IDENTITY, true);
export const RequirePermission = (
  permission: PermissionCode,
  target: Requirement['target'] = 'organization',
) => SetMetadata(PERMISSION, { permission, target } satisfies Requirement);
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<SecurityRequest>().principal;
    if (!principal) throw new Error('Authenticated principal missing');
    return principal;
  },
);
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const tenant = context.switchToHttp().getRequest<SecurityRequest>().tenant;
    if (!tenant) throw new Error('Authorized tenant context missing');
    return tenant;
  },
);
