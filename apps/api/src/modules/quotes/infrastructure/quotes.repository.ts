import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  buyerSnapshotSchema,
  currencySchema,
  quoteResponseSchema,
  quoteHistoryResponseSchema,
} from '@crm/contracts';
import type {
  CreateQuote,
  UpdateQuote,
  QuoteQuery,
  QuoteHistoryQuery,
  QuoteResponse,
  QuoteSummary,
  QuoteLineInput,
  PermissionCode,
} from '@crm/contracts';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import {
  AccessControlService,
  commercialScope,
  permits,
  assignmentScope,
} from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CatalogLookupGateway } from '../../catalog/index.js';
import { ContactsLookupGateway } from '../../contacts/index.js';
import { CompaniesLookupGateway } from '../../companies/index.js';
import { OpportunitiesGateway } from '../../opportunities/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
import { calculateQuote } from '../domain/quote-calculation.js';
import type { ListQuery } from '@crm/contracts';
const detail = { items: { orderBy: { position: 'asc' as const } } } satisfies Prisma.QuoteInclude;
type Row = Prisma.QuoteGetPayload<{ include: typeof detail }>;
type Line = {
  productId: string;
  description: string;
  sku: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizedDecimal = (value: string) => {
  const [whole = '0', fraction = ''] = value.split('.');
  const remainder = fraction.replace(/0+$/, '');
  return BigInt(whole).toString() + (remainder ? '.' + remainder : '');
};
@Injectable()
export class QuotesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CatalogLookupGateway) private readonly catalog: CatalogLookupGateway,
    @Inject(ContactsLookupGateway) private readonly contacts: ContactsLookupGateway,
    @Inject(CompaniesLookupGateway) private readonly companies: CompaniesLookupGateway,
    @Inject(OpportunitiesGateway) private readonly opportunities: OpportunitiesGateway,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
  ) {}
  private summary(row: Prisma.QuoteGetPayload<Record<string, never>>): QuoteSummary {
    return {
      id: row.id,
      rootQuoteId: row.rootQuoteId,
      previousQuoteId: row.previousQuoteId,
      revision: row.revision,
      name: row.name,
      branchId: row.branchId,
      ownerMembershipId: row.ownerMembershipId,
      opportunityId: row.opportunityId,
      currency: currencySchema.parse(row.currency),
      status: row.status,
      subtotal: row.subtotal.toFixed(2),
      discount: row.discount.toFixed(2),
      total: row.total.toFixed(2),
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private response(context: TenantContext, row: Row): QuoteResponse {
    const resource = { branchId: row.branchId, ownerMembershipId: row.ownerMembershipId };
    return {
      ...this.summary(row),
      contactId: row.contactId,
      companyId: row.companyId,
      buyer: buyerSnapshotSchema.parse(row.buyerSnapshot),
      priceListId: row.priceListId,
      priceListName: row.priceListName,
      validUntil: row.validUntil?.toISOString().slice(0, 10) ?? null,
      notes: row.notes,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      items: row.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity.toFixed(6),
        unitPrice: item.unitPrice.toFixed(6),
        discountPercent: item.discountPercent.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
        discount: item.discount.toFixed(2),
        total: item.total.toFixed(2),
      })),
      canUpdate: row.status === 'DRAFT' && permits(context, 'quotes.update', resource),
      canApprove: row.status === 'DRAFT' && permits(context, 'quotes.approve', resource),
      canRevise: row.status === 'APPROVED' && permits(context, 'quotes.create', resource),
    };
  }
  private async visible(
    tx: DatabaseTransaction,
    context: TenantContext,
    id: string,
    permission: PermissionCode = 'quotes.read',
  ) {
    const row = await tx.quote.findFirst({
      where: {
        AND: [
          commercialScope(context, 'quotes.read'),
          commercialScope(context, permission),
          { id },
        ],
      },
      include: detail,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Quote unavailable.');
    return row;
  }
  async get(context: TenantContext, id: string) {
    return this.response(context, await this.visible(this.database.client, context, id));
  }
  async list(context: TenantContext, query: QuoteQuery) {
    if (query.opportunityId)
      await this.opportunities.get(this.database.client, context, query.opportunityId);
    const rows = await this.database.client.quote.findMany({
      where: {
        AND: [
          commercialScope(context, 'quotes.read'),
          cursorFilter(query),
          {
            ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.ownerMembershipId ? { ownerMembershipId: query.ownerMembershipId } : {}),
            ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
          },
        ],
      },
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(
      rows.map((row) => this.summary(row)),
      query,
    );
  }
  async history(context: TenantContext, id: string, query: QuoteHistoryQuery) {
    await this.visible(this.database.client, context, id);
    const rows = await this.database.client.quoteHistory.findMany({
      where: {
        organizationId: context.organizationId,
        quoteId: id,
        recordVersion: { gt: query.afterVersion },
        quote: commercialScope(context, 'quotes.read'),
      },
      orderBy: { recordVersion: 'asc' },
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    return quoteHistoryResponseSchema.parse({
      data: page.map((row) => ({
        id: row.id,
        kind: row.kind,
        recordVersion: row.recordVersion,
        actorMembershipId: row.actorMembershipId,
        createdAt: row.createdAt.toISOString(),
      })),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? String(page.at(-1)?.recordVersion) : null,
      },
    });
  }

  branches(context: TenantContext, query: ListQuery) {
    const scope = assignmentScope(context, 'quotes.create');
    // Quote owner is always the creator; only their linked branches may be selected.
    const ids = context.branches
      .map((branch) => branch.id)
      .filter((id) => !scope.branchIds || scope.branchIds.includes(id));
    return this.directory.branches(this.database.client, context.organizationId, ids, query);
  }
  private data(lines: Line[]) {
    const calculation = calculateQuote(lines);
    return {
      subtotal: calculation.subtotal,
      discount: calculation.discount,
      total: calculation.total,
      items: lines.map((line, position) => {
        const totals = calculation.items[position];
        if (!totals) throw new Error('Quote calculation missing');
        return { ...line, position, ...totals };
      }),
    };
  }
  private async snapshotLines(
    tx: DatabaseTransaction,
    context: TenantContext,
    listId: string,
    branchId: string,
    input: QuoteLineInput[],
    existing: Line[] = [],
  ) {
    const saved = new Map(existing.map((item) => [item.productId, item]));
    const missing = input.filter((item) => !saved.has(item.productId));
    const lookup = missing.length
      ? await this.catalog.quotePrices(
          tx,
          context,
          listId,
          branchId,
          missing.map((item) => item.productId),
        )
      : null;
    return input.map((item) => {
      const source = saved.get(item.productId) ?? lookup?.products.get(item.productId);
      if (!source) throw new Error('Quote price projection missing');
      return {
        productId: item.productId,
        description: source.description,
        sku: source.sku,
        unit: source.unit,
        unitPrice: source.unitPrice,
        quantity: item.quantity,
        discountPercent: item.discountPercent,
      };
    });
  }
  private audit(
    tx: DatabaseTransaction,
    context: TenantContext,
    row: Row,
    kind: 'CREATED' | 'UPDATED' | 'APPROVED' | 'REVISED',
  ) {
    return tx.quoteHistory.create({
      data: {
        organizationId: context.organizationId,
        quoteId: row.id,
        actorMembershipId: context.membershipId,
        kind,
        recordVersion: row.version,
      },
    });
  }
  private async replay(
    tx: DatabaseTransaction,
    context: TenantContext,
    operation: string,
    key: string,
    requestHash: string,
  ) {
    const stored = await tx.quoteRequest.findUnique({
      where: {
        organizationId_actorMembershipId_operation_keyHash: {
          organizationId: context.organizationId,
          actorMembershipId: context.membershipId,
          operation,
          keyHash: hash(key),
        },
      },
    });
    if (!stored) return null;
    if (stored.requestHash !== requestHash)
      throw new ApplicationError(
        'RESOURCE_CONFLICT',
        'Idempotency key already used for another request.',
      );
    const current = await this.visible(tx, context, stored.quoteId, 'quotes.create');
    const response = quoteResponseSchema.parse(stored.response);
    const capabilities = this.response(context, current);
    return {
      ...response,
      canUpdate: current.version === response.version && capabilities.canUpdate,
      canApprove: current.version === response.version && capabilities.canApprove,
      canRevise: current.version === response.version && capabilities.canRevise,
    };
  }
  private remember(
    tx: DatabaseTransaction,
    context: TenantContext,
    operation: string,
    key: string,
    requestHash: string,
    result: QuoteResponse,
  ) {
    return tx.quoteRequest.create({
      data: {
        organizationId: context.organizationId,
        actorMembershipId: context.membershipId,
        operation,
        keyHash: hash(key),
        requestHash,
        quoteId: result.id,
        response: result,
      },
    });
  }
  create(context: TenantContext, input: CreateQuote, key: string) {
    const requestHash = hash(
      JSON.stringify({
        name: input.name,
        branchId: input.branchId,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        opportunityId: input.opportunityId ?? null,
        priceListId: input.priceListId,
        validUntil: input.validUntil ?? null,
        notes: input.notes ?? null,
        items: input.items.map((item) => ({
          productId: item.productId,
          quantity: normalizedDecimal(item.quantity),
          discountPercent: normalizedDecimal(item.discountPercent),
        })),
      }),
    );
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'quotes.create',
          'collection',
        );
        const replay = await this.replay(tx, fresh, 'create', key, requestHash);
        if (replay) return replay;
        const ownerMembershipId = fresh.membershipId;
        if (
          !permits(fresh, 'quotes.create', { branchId: input.branchId, ownerMembershipId }) ||
          !permits(fresh, 'quotes.read', { branchId: input.branchId, ownerMembershipId })
        )
          throw new ApplicationError('FORBIDDEN', 'Quote destination outside action scope.');
        await this.directory.assignment(
          tx,
          fresh.organizationId,
          input.branchId,
          ownerMembershipId,
        );
        const buyer = input.contactId
          ? await this.contacts.buyerSnapshot(tx, fresh, input.contactId)
          : input.companyId
            ? await this.companies.buyerSnapshot(tx, fresh, input.companyId)
            : null;
        if (!buyer) throw new ApplicationError('INVALID_INPUT', 'Buyer required.');
        const lookup = await this.catalog.quotePrices(
          tx,
          fresh,
          input.priceListId,
          input.branchId,
          input.items.map((item) => item.productId),
        );
        if (input.opportunityId) {
          const opportunity = await this.opportunities.get(tx, fresh, input.opportunityId);
          if (
            !opportunity.active ||
            opportunity.branch.id !== input.branchId ||
            opportunity.currency !== lookup.list.currency ||
            (input.contactId
              ? opportunity.contact?.id !== input.contactId
              : opportunity.company?.id !== input.companyId)
          )
            throw new ApplicationError(
              'INVALID_INPUT',
              'Opportunity must match quote branch, buyer and currency.',
            );
        }
        const lines = input.items.map((item) => {
          const product = lookup.products.get(item.productId);
          if (!product) throw new Error('Quote product projection missing');
          return { ...product, quantity: item.quantity, discountPercent: item.discountPercent };
        });
        const calculated = this.data(lines),
          id = randomUUID();
        const row = await tx.quote.create({
          data: {
            id,
            rootQuoteId: id,
            organizationId: fresh.organizationId,
            name: input.name,
            branchId: input.branchId,
            ownerMembershipId,
            contactId: input.contactId ?? null,
            companyId: input.companyId ?? null,
            opportunityId: input.opportunityId ?? null,
            priceListId: input.priceListId,
            priceListName: lookup.list.name,
            currency: lookup.list.currency,
            buyerSnapshot: buyer,
            validUntil: input.validUntil ? new Date(input.validUntil) : null,
            notes: input.notes ?? null,
            createdByMembershipId: fresh.membershipId,
            subtotal: calculated.subtotal,
            discount: calculated.discount,
            total: calculated.total,
            items: {
              create: calculated.items,
            },
          },
          include: detail,
        });
        await this.audit(tx, fresh, row, 'CREATED');
        const result = this.response(fresh, row);
        await this.remember(tx, fresh, 'create', key, requestHash, result);
        return result;
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdateQuote) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'quotes.update',
          'collection',
        );
        await tx.$queryRaw`SELECT id FROM quotes WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const current = await this.visible(tx, fresh, id, 'quotes.update');
        this.version(current, input.expectedVersion, 'DRAFT');
        const existing = this.response(fresh, current).items;
        const lines = await this.snapshotLines(
          tx,
          fresh,
          current.priceListId,
          current.branchId,
          input.items,
          existing,
        );
        const calculated = this.data(lines);
        await tx.quoteItem.deleteMany({
          where: { organizationId: fresh.organizationId, quoteId: id },
        });
        const row = await tx.quote.update({
          where: { organizationId_id: { organizationId: fresh.organizationId, id } },
          data: {
            version: { increment: 1 },
            subtotal: calculated.subtotal,
            discount: calculated.discount,
            total: calculated.total,
            ...(input.validUntil !== undefined
              ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
              : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            items: {
              create: calculated.items,
            },
          },
          include: detail,
        });
        await this.audit(tx, fresh, row, 'UPDATED');
        return this.response(fresh, row);
      }),
    );
  }
  private version(row: Row, version: number, status: 'DRAFT' | 'APPROVED') {
    if (row.version !== version || row.status !== status)
      throw new ApplicationError(
        'RESOURCE_CONFLICT',
        'Quote state or version changed. Reload before saving.',
      );
  }
  approve(context: TenantContext, id: string, version: number) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'quotes.approve',
          'collection',
        );
        await tx.$queryRaw`SELECT id FROM quotes WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const current = await this.visible(tx, fresh, id, 'quotes.approve');
        this.version(current, version, 'DRAFT');
        if (
          current.validUntil &&
          current.validUntil.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)
        )
          throw new ApplicationError('INVALID_INPUT', 'Expired quote cannot be approved.');
        const row = await tx.quote.update({
          where: { organizationId_id: { organizationId: fresh.organizationId, id } },
          data: {
            status: 'APPROVED',
            version: { increment: 1 },
            approvedAt: new Date(),
            approvedByMembershipId: fresh.membershipId,
          },
          include: detail,
        });
        await this.audit(tx, fresh, row, 'APPROVED');
        return this.response(fresh, row);
      }),
    );
  }
  revise(context: TenantContext, id: string, version: number, key: string) {
    const operation = 'revise:' + id,
      requestHash = hash(JSON.stringify({ expectedVersion: version }));
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'quotes.create',
          'collection',
        );
        const replay = await this.replay(tx, fresh, operation, key, requestHash);
        if (replay) return replay;
        await tx.$queryRaw`SELECT id FROM quotes WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const current = await this.visible(tx, fresh, id, 'quotes.create');
        this.version(current, version, 'APPROVED');
        await this.directory.assignment(
          tx,
          fresh.organizationId,
          current.branchId,
          current.ownerMembershipId,
        );
        // Keep original branch/owner and financial/buyer snapshots; revision never refreshes catalog.
        const calculated = this.data(this.response(fresh, current).items);
        const row = await tx.quote.create({
          data: {
            organizationId: fresh.organizationId,
            rootQuoteId: current.rootQuoteId,
            previousQuoteId: id,
            revision: current.revision + 1,
            name: current.name,
            branchId: current.branchId,
            ownerMembershipId: current.ownerMembershipId,
            contactId: current.contactId,
            companyId: current.companyId,
            opportunityId: current.opportunityId,
            priceListId: current.priceListId,
            priceListName: current.priceListName,
            buyerSnapshot: buyerSnapshotSchema.parse(current.buyerSnapshot),
            currency: current.currency,
            validUntil: current.validUntil,
            notes: current.notes,
            createdByMembershipId: fresh.membershipId,
            subtotal: calculated.subtotal,
            discount: calculated.discount,
            total: calculated.total,
            items: {
              create: calculated.items,
            },
          },
          include: detail,
        });
        await this.audit(tx, fresh, row, 'REVISED');
        const result = this.response(fresh, row);
        await this.remember(tx, fresh, operation, key, requestHash, result);
        return result;
      }),
    );
  }
}
