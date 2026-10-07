import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePipeline,
  UpdatePipeline,
  PipelineListQuery,
  AddStage,
  UpdateStage,
  ReorderStages,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { PipelinesRepository } from '../infrastructure/pipelines.repository.js';
@Injectable()
export class PipelinesService {
  constructor(
    @Inject(PipelinesRepository) private readonly repository: PipelinesRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  list(context: TenantContext, query: PipelineListQuery) {
    return this.repository.list(context, query);
  }
  get(context: TenantContext, id: string) {
    return this.repository.get(context, id);
  }
  async create(context: TenantContext, input: CreatePipeline) {
    const result = await this.repository.create(context, input);
    this.logger.info('pipelines.create', 'pipelines', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: result.id,
    });
    return result;
  }
  async update(context: TenantContext, id: string, input: UpdatePipeline) {
    const result = await this.repository.update(context, id, input);
    this.logger.info('pipelines.update', 'pipelines', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async archive(context: TenantContext, id: string, version: number) {
    const result = await this.repository.archive(context, id, version);
    this.logger.info('pipelines.archive', 'pipelines', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async addStage(context: TenantContext, id: string, input: AddStage) {
    const result = await this.repository.addStage(context, id, input);
    this.logger.info('pipelines.addStage', 'pipelines', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async updateStage(context: TenantContext, id: string, stageId: string, input: UpdateStage) {
    const result = await this.repository.updateStage(context, id, stageId, input);
    this.logger.info('pipelines.updateStage', 'pipelines', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async reorder(context: TenantContext, id: string, input: ReorderStages) {
    const result = await this.repository.reorder(context, id, input);
    this.logger.info('pipelines.reorder', 'pipelines', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
}
