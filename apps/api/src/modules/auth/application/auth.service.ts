import { Inject, Injectable } from '@nestjs/common';
import type { ApiConfig } from '@crm/config/server';
import type { Login, ChangePassword, MeResponse, AuthResponse } from '@crm/contracts';
import type { Principal } from '../../../common/security.js';
import { RUNTIME_CONFIG, StructuredLogger } from '../../runtime/index.js';
import { UserCredentialsGateway, UserIdentityGateway } from '../../users/index.js';
import { OrganizationsAccessGateway } from '../../organizations/index.js';
import { AccessControlService } from '../../access-control/index.js';
import { PasswordService } from '../password.module.js';
import { SessionRepository } from '../infrastructure/session.repository.js';
import {
  TokenService,
  newRefreshToken,
  validRefreshToken,
  unauthenticated,
} from '../infrastructure/token.service.js';
@Injectable()
export class AuthService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: ApiConfig,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(UserCredentialsGateway) private readonly credentials: UserCredentialsGateway,
    @Inject(UserIdentityGateway) private readonly identities: UserIdentityGateway,
    @Inject(OrganizationsAccessGateway) private readonly organizations: OrganizationsAccessGateway,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  async login(input: Login) {
    const user = await this.credentials.byEmail(input.email);
    const valid = await this.passwords.verify(
      input.password,
      user?.active ? user.passwordHash : null,
    );
    if (!user?.active || !valid) {
      this.logger.info('login rejected', 'auth');
      throw unauthenticated();
    }
    const refreshToken = newRefreshToken();
    const session = await this.sessions.create(
      user,
      refreshToken,
      new Date(Date.now() + this.config.SESSION_TTL_SECONDS * 1000),
    );
    const principal = {
      userId: session.userId,
      sessionId: session.id,
      membershipId: session.membershipId,
      contextVersion: session.contextVersion,
    };
    this.logger.info('login succeeded', 'auth', {
      userId: principal.userId,
      sessionId: principal.sessionId,
    });
    return { response: await this.issue(principal, session.expiresAt), refreshToken };
  }
  async authenticate(token: string) {
    return this.sessions.validate(await this.tokens.verify(token));
  }
  async me(principal: Principal): Promise<MeResponse> {
    const user = await this.identities.publicById(principal.userId);
    if (!user?.active) throw unauthenticated();
    const memberships = await this.organizations.available(principal.userId);
    const context = principal.membershipId ? await this.access.context(principal) : null;
    return {
      user,
      memberships,
      context: context
        ? {
            organizationId: context.organizationId,
            organizationName: context.organizationName,
            membershipId: context.membershipId,
            primaryBranchId: context.primaryBranchId,
            branches: context.branches,
            roles: context.grants.map((grant) => ({
              id: grant.roleId,
              code: grant.code,
              name: grant.name,
              scope: grant.scope,
            })),
          }
        : null,
    };
  }
  private async issue(principal: Principal, expiresAt: Date): Promise<AuthResponse> {
    return {
      ...(await this.me(principal)),
      accessToken: await this.tokens.sign(principal),
      expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
      sessionExpiresAt: expiresAt.toISOString(),
    };
  }
  async refresh(token: string | undefined) {
    if (!token || !validRefreshToken(token)) throw unauthenticated();
    const refreshToken = newRefreshToken();
    const result = await this.sessions.rotate(token, refreshToken);
    if (result.kind !== 'rotated') {
      if (result.kind === 'reused')
        this.logger.info('refresh reuse revoked session', 'auth', { sessionId: result.sessionId });
      throw unauthenticated();
    }
    const session = result.session;
    return {
      response: await this.issue(
        {
          userId: session.userId,
          sessionId: session.id,
          membershipId: session.membershipId,
          contextVersion: session.contextVersion,
        },
        session.expiresAt,
      ),
      refreshToken,
    };
  }
  async select(principal: Principal, organizationId: string) {
    const session = await this.sessions.select(principal, organizationId);
    this.logger.info('organization context selected', 'auth', {
      userId: principal.userId,
      sessionId: principal.sessionId,
      organizationId,
    });
    return this.issue(
      {
        userId: session.userId,
        sessionId: session.id,
        membershipId: session.membershipId,
        contextVersion: session.contextVersion,
      },
      session.expiresAt,
    );
  }
  async logout(token: string | undefined) {
    const sessionId =
      token && validRefreshToken(token) ? await this.sessions.logoutToken(token) : undefined;
    this.logger.info('session logout', 'auth', sessionId ? { sessionId } : {});
  }
  async logoutAll(principal: Principal) {
    await this.sessions.logoutAll(principal);
    this.logger.info('all sessions revoked', 'auth', { userId: principal.userId });
  }
  async changePassword(principal: Principal, input: ChangePassword) {
    const snapshot = await this.credentials.byId(principal.userId);
    const valid = await this.passwords.verify(
      input.currentPassword,
      snapshot?.active ? snapshot.passwordHash : null,
    );
    if (!snapshot?.active || !valid) throw unauthenticated();
    await this.sessions.changePassword(
      principal,
      snapshot,
      await this.passwords.hash(input.newPassword),
    );
    this.logger.info('password changed and sessions revoked', 'auth', { userId: principal.userId });
  }
}
