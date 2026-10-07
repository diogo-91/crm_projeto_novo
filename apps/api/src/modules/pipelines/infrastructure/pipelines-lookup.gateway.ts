import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { PipelinesRepository } from './pipelines.repository.js';
@Injectable()
export class PipelinesLookupGateway {
  constructor(@Inject(PipelinesRepository) private readonly repository: PipelinesRepository) {}
  destination(
    tx: DatabaseTransaction,
    context: TenantContext,
    pipelineId: string,
    stageId: string,
    branchId: string,
  ) {
    return this.repository.destination(tx, context, pipelineId, stageId, branchId);
  }
  labels(tx: DatabaseTransaction, organizationId: string, stageIds: string[]) {
    return this.repository.labels(tx, organizationId, stageIds);
  }
}
