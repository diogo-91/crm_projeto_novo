import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import { OrganizationsAccessGateway } from '../../organizations/index.js';
import { UserCredentialsGateway } from '../../users/index.js';
import type { Credential } from '../../users/index.js';
import type { Principal } from '../../../common/security.js';
import { unauthenticated, refreshHash } from './token.service.js';
import { ApplicationError } from '../../../common/application-error.js';
@Injectable()
export class SessionRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(UserCredentialsGateway) private readonly users: UserCredentialsGateway,
    @Inject(OrganizationsAccessGateway) private readonly organizations: OrganizationsAccessGateway,
  ) {}
  create(snapshot: Credential, token: string, expiresAt: Date) {
    return this.database.client.$transaction(async (transaction) => {
      const current = await this.users.byId(snapshot.id, transaction);
      if (
        !current?.active ||
        current.securityVersion !== snapshot.securityVersion ||
        current.passwordHash !== snapshot.passwordHash
      )
        throw unauthenticated();
      const memberships = await this.organizations.available(snapshot.id, transaction);
      const session = await transaction.session.create({
        data: {
          userId: snapshot.id,
          securityVersion: snapshot.securityVersion,
          membershipId: memberships.length === 1 ? (memberships[0]?.membershipId ?? null) : null,
          expiresAt,
        },
      });
      await transaction.refreshToken.create({
        data: { sessionId: session.id, tokenHash: refreshHash(token) },
      });
      return session;
    });
  }
  async validate(claims: {
    userId: string;
    sessionId: string;
    contextVersion: number;
  }): Promise<Principal> {
    const session = await this.database.client.session.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        contextVersion: claims.contextVersion,
      },
      include: { user: { select: { active: true, securityVersion: true } } },
    });
    if (!session?.user.active || session.securityVersion !== session.user.securityVersion)
      throw unauthenticated();
    return {
      userId: session.userId,
      sessionId: session.id,
      membershipId: session.membershipId,
      contextVersion: session.contextVersion,
    };
  }
  async rotate(token: string, successor: string) {
    return this.database.client.$transaction(async (transaction) => {
      const initial = await transaction.refreshToken.findUnique({
        where: { tokenHash: refreshHash(token) },
      });
      if (!initial) return { kind: 'invalid' as const };
      const locked = await transaction.session.updateMany({
        where: { id: initial.sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { lastUsedAt: new Date() },
      });
      if (locked.count !== 1) return { kind: 'invalid' as const };
      const refresh = await transaction.refreshToken.findUniqueOrThrow({
        where: { id: initial.id },
      });
      const session = await transaction.session.findUniqueOrThrow({
        where: { id: initial.sessionId },
      });
      const user = await this.users.byId(session.userId, transaction);
      const contextValid =
        session.membershipId === null ||
        (await this.organizations.context(session.userId, session.membershipId, transaction)) !==
          null;
      if (
        refresh.usedAt !== null ||
        !user?.active ||
        session.securityVersion !== user.securityVersion ||
        !contextValid
      ) {
        await transaction.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        // Return, rather than throw, to COMMIT family revocation before the HTTP error.
        return {
          kind: refresh.usedAt !== null ? ('reused' as const) : ('invalid' as const),
          sessionId: session.id,
        };
      }
      await transaction.refreshToken.update({
        where: { id: refresh.id },
        data: { usedAt: new Date() },
      });
      await transaction.refreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: refreshHash(successor),
          predecessorId: refresh.id,
        },
      });
      return { kind: 'rotated' as const, session };
    });
  }
  select(principal: Principal, organizationId: string) {
    return this.database.client.$transaction(async (transaction) => {
      const session = await this.lockSession(transaction, principal);
      const available = await this.organizations.available(principal.userId, transaction);
      const membership = available.find((item) => item.organizationId === organizationId);
      if (!membership)
        throw new ApplicationError('FORBIDDEN', 'No active membership for this organization.');
      return transaction.session.update({
        where: { id: session.id },
        data: { membershipId: membership.membershipId, contextVersion: { increment: 1 } },
      });
    });
  }
  private async lockSession(transaction: DatabaseTransaction, principal: Principal) {
    const locked = await transaction.session.updateMany({
      where: {
        id: principal.sessionId,
        userId: principal.userId,
        contextVersion: principal.contextVersion,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { lastUsedAt: new Date() },
    });
    if (locked.count !== 1) throw unauthenticated();
    const session = await transaction.session.findUniqueOrThrow({
      where: { id: principal.sessionId },
    });
    const user = await this.users.byId(principal.userId, transaction);
    if (!user?.active || user.securityVersion !== session.securityVersion) throw unauthenticated();
    return session;
  }
  async revokeSession(sessionId: string) {
    await this.database.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  async logoutToken(token: string) {
    const row = await this.database.client.refreshToken.findUnique({
      where: { tokenHash: refreshHash(token) },
      select: { sessionId: true },
    });
    if (row) await this.revokeSession(row.sessionId);
    return row?.sessionId;
  }
  async logoutAll(principal: Principal) {
    await this.database.client.$transaction(async (transaction) => {
      await this.users.invalidate(transaction, principal.userId);
      await transaction.session.updateMany({
        where: { userId: principal.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
  async changePassword(principal: Principal, snapshot: Credential, passwordHash: string) {
    // Lock User before Sessions consistently with logoutAll, to avoid lock-order cycles.
    await this.database.client.$transaction(async (transaction) => {
      const changed = await this.users.replacePassword(transaction, snapshot, passwordHash);
      if (changed.count !== 1) throw unauthenticated();
      const session = await transaction.session.findFirst({
        where: {
          id: principal.sessionId,
          userId: principal.userId,
          contextVersion: principal.contextVersion,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session || session.securityVersion !== snapshot.securityVersion) throw unauthenticated();
      await transaction.session.updateMany({
        where: { userId: principal.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
