import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Inject,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  addStageSchema,
  updateStageSchema,
  reorderStagesSchema,
  createPipelineSchema,
  updatePipelineSchema,
  pipelineListQuerySchema,
  pipelineListResponseSchema,
  pipelineResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
} from '@crm/contracts';
import type {
  AddStage,
  UpdateStage,
  ReorderStages,
  CreatePipeline,
  UpdatePipeline,
  PipelineListQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { PipelinesService } from '../application/pipelines.service.js';
@ApiTags('pipelines')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  description: 'Invalid input',
  content: { 'application/problem+json': { schema: openApiSchema(problemResponseSchema) } },
})
@ApiResponse({ status: 401, description: 'Invalid session' })
@ApiResponse({ status: 403, description: 'Permission and scope required' })
@ApiResponse({ status: 404, description: 'Resource not found or outside scope' })
@ApiResponse({ status: 409, description: 'Duplicate or concurrent change' })
@Controller('pipelines')
export class PipelinesController {
  constructor(@Inject(PipelinesService) private readonly service: PipelinesService) {}
  @RequirePermission('pipelines.manage', 'tenant')
  @Post()
  @ApiBody({ schema: openApiSchema(createPipelineSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(pipelineResponseSchema) })
  create(
    @CurrentTenant() context: TenantContext,
    @Body(new ZodPipe(createPipelineSchema)) input: CreatePipeline,
  ) {
    return this.service.create(context, input);
  }
  @RequirePermission('pipelines.read', 'tenant')
  @Get()
  @ApiListQuery(pipelineListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(pipelineListResponseSchema) })
  list(
    @CurrentTenant() context: TenantContext,
    @Query(new ZodPipe(pipelineListQuerySchema)) query: PipelineListQuery,
  ) {
    return this.service.list(context, query);
  }
  @RequirePermission('pipelines.read', 'tenant')
  @Get(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(pipelineResponseSchema) })
  get(@CurrentTenant() context: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(context, id);
  }
  @RequirePermission('pipelines.manage', 'tenant')
  @Patch(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updatePipelineSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(pipelineResponseSchema) })
  update(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updatePipelineSchema)) input: UpdatePipeline,
  ) {
    return this.service.update(context, id, input);
  }
  @RequirePermission('pipelines.manage', 'tenant')
  @Delete(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOperation({ summary: 'Deactivate; preserves record and relationships' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(pipelineResponseSchema) })
  archive(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archive(context, id, input.expectedVersion);
  }
  @RequirePermission('pipelines.manage', 'tenant')
  @Post(':id/stages')
  @HttpCode(200)
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(addStageSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(pipelineResponseSchema) })
  addStage(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,

    @Body(new ZodPipe(addStageSchema)) input: AddStage,
  ) {
    return this.service.addStage(context, id, input);
  }
  @RequirePermission('pipelines.manage', 'tenant')
  @Patch(':id/stages/:stageId')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiParam({ name: 'stageId', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateStageSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(pipelineResponseSchema) })
  updateStage(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Param('stageId', new ZodPipe(uuidSchema)) stageId: string,
    @Body(new ZodPipe(updateStageSchema)) input: UpdateStage,
  ) {
    return this.service.updateStage(context, id, stageId, input);
  }
  @RequirePermission('pipelines.manage', 'tenant')
  @Post(':id/stages/reorder')
  @HttpCode(200)
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(reorderStagesSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(pipelineResponseSchema) })
  reorder(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,

    @Body(new ZodPipe(reorderStagesSchema)) input: ReorderStages,
  ) {
    return this.service.reorder(context, id, input);
  }
}
