import { Inject, Injectable } from '@nestjs/common';
import type { CreateTag, UpdateTag, TagListQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { TagsRepository } from '../infrastructure/tags.repository.js';
@Injectable()
export class TagsService {
  constructor(
    @Inject(TagsRepository) private readonly repository: TagsRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  list(context: TenantContext, query: TagListQuery) {
    return this.repository.list(context, query);
  }
  async create(context: TenantContext, input: CreateTag) {
    const result = await this.repository.create(context, input);
    this.event('tag.created', context, result.id);
    return result;
  }
  async update(context: TenantContext, id: string, input: UpdateTag) {
    const result = await this.repository.update(context, id, input);
    this.event('tag.updated', context, id);
    return result;
  }
  async archive(context: TenantContext, id: string, version: number) {
    const result = await this.repository.archive(context, id, version);
    this.event('tag.deactivated', context, id);
    return result;
  }

  private event(event: string, context: TenantContext, id: string) {
    this.logger.info(event, 'tags', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
  }
}
