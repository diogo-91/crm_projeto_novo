import { Inject, Injectable } from '@nestjs/common';
import type { CreateActivity, ResourceTarget, TimelineQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { ActivitiesRepository } from '../infrastructure/activities.repository.js';
import { StructuredLogger } from '../../runtime/index.js';
@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(ActivitiesRepository) private readonly repository: ActivitiesRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  async create(context: TenantContext, input: CreateActivity) {
    const row = await this.repository.create(context, input);
    this.logger.info('activity recorded', 'activities', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: row.id,
    });
    return row;
  }
  timeline(context: TenantContext, target: ResourceTarget, query: TimelineQuery) {
    return this.repository.timeline(context, target, query);
  }
}
