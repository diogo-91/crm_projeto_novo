import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { ApiConfig } from '@crm/config/server';
import { uuidSchema } from '@crm/contracts';
import { AuthService, AuthRateService } from '../modules/auth/index.js';
import {
  AccessControlService,
  collectionScope,
  orgPermission,
} from '../modules/access-control/index.js';
import { RUNTIME_CONFIG } from '../modules/runtime/index.js';
import { ApplicationError } from './application-error.js';
import { COOKIE_FLOW, PUBLIC, IDENTITY, PERMISSION } from './security.js';
import type { SecurityRequest, Requirement } from './security.js';
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthRateService) private readonly rates: AuthRateService,
    @Inject(RUNTIME_CONFIG) private readonly config: ApiConfig,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SecurityRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    const cookieFlow = this.reflector.getAllAndOverride<'login' | 'refresh' | 'logout'>(
      COOKIE_FLOW,
      [context.getHandler(), context.getClass()],
    );
    if (cookieFlow) {
      if (!request.headers.origin || !this.config.CORS_ORIGINS.includes(request.headers.origin))
        throw new ApplicationError('FORBIDDEN', 'An allowed Origin is required.');
      if (
        request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
      )
        throw new ApplicationError('INVALID_INPUT', 'JSON body required.');
      const kind = cookieFlow;
      if (kind === 'login' || kind === 'refresh')
        await this.rates.consume(
          kind,
          request.ip ?? request.socket.remoteAddress ?? 'unknown',
          request.body as unknown,
          response,
        );
    }
    if (isPublic) return true;
    const authorization = request.headers.authorization;
    if (
      !authorization ||
      !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) ||
      authorization.length > 2048
    )
      throw new ApplicationError('UNAUTHENTICATED', 'Bearer access token required.');
    request.principal = await this.auth.authenticate(authorization.slice(7));
    return true;
  }
}
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets) === true) return true;
    const request = context.switchToHttp().getRequest<SecurityRequest>();
    if (!request.principal)
      throw new ApplicationError('UNAUTHENTICATED', 'Authenticated principal required.');
    if (this.reflector.getAllAndOverride<boolean>(IDENTITY, targets) === true) return true;
    const requirement = this.reflector.getAllAndOverride<Requirement>(PERMISSION, targets);
    if (!requirement)
      throw new ApplicationError('FORBIDDEN', 'Endpoint permission is not defined.');
    if (requirement.target === 'platform') {
      await this.access.platform(request.principal, requirement.permission);
      return true;
    }
    const id = uuidSchema.safeParse(request.params['organizationId'] ?? request.params['id']);
    if (!id.success)
      throw new ApplicationError('INVALID_INPUT', 'Valid organization UUID required.');
    const tenant = await this.access.context(request.principal);
    if (id.data !== tenant.organizationId)
      throw new ApplicationError(
        'RESOURCE_NOT_FOUND',
        'Resource unavailable in selected organization.',
      );
    if (requirement.target === 'collection') collectionScope(tenant, requirement.permission);
    else orgPermission(tenant, requirement.permission);
    request.tenant = tenant;
    return true;
  }
}
