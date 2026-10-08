import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateQuote,
  UpdateQuote,
  QuoteQuery,
  QuoteHistoryQuery,
  ListQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { QuotesRepository } from '../infrastructure/quotes.repository.js';
@Injectable()
export class QuotesService {
  constructor(
    @Inject(QuotesRepository) private readonly repository: QuotesRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  list(c: TenantContext, q: QuoteQuery) {
    return this.repository.list(c, q);
  }
  get(c: TenantContext, id: string) {
    return this.repository.get(c, id);
  }
  history(c: TenantContext, id: string, q: QuoteHistoryQuery) {
    return this.repository.history(c, id, q);
  }
  branches(c: TenantContext, q: ListQuery) {
    return this.repository.branches(c, q);
  }
  async create(c: TenantContext, input: CreateQuote, key: string) {
    const result = await this.repository.create(c, input, key);
    this.log(c, 'quotes.create', result.id);
    return result;
  }
  async update(c: TenantContext, id: string, input: UpdateQuote) {
    const result = await this.repository.update(c, id, input);
    this.log(c, 'quotes.update', id);
    return result;
  }
  async approve(c: TenantContext, id: string, version: number) {
    const result = await this.repository.approve(c, id, version);
    this.log(c, 'quotes.approve', id);
    return result;
  }
  async revise(c: TenantContext, id: string, version: number, key: string) {
    const result = await this.repository.revise(c, id, version, key);
    this.log(c, 'quotes.revise', result.id);
    return result;
  }
  private log(c: TenantContext, event: string, id: string) {
    this.logger.info(event, 'quotes', {
      organizationId: c.organizationId,
      membershipId: c.membershipId,
      entityId: id,
    });
  }
}
