import type { Principal } from '../../../common/security.js';
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
  moveOpportunitySchema,
  stageHistoryListResponseSchema,
  listQuerySchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  opportunityListQuerySchema,
  opportunityListResponseSchema,
  opportunityResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
  assignmentQuerySchema,
  assignmentListResponseSchema,
} from '@crm/contracts';
import type {
  MoveOpportunity,
  ListQuery,
  CreateOpportunity,
  UpdateOpportunity,
  OpportunityListQuery,
  AssignmentQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import {
  CurrentTenant,
  RequirePermission,
  CurrentPrincipal,
  IdentityEndpoint,
} from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { OpportunitiesService } from '../application/opportunities.service.js';
@ApiTags('opportunities')
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
@Controller('opportunities')
export class OpportunitiesController {
  constructor(@Inject(OpportunitiesService) private readonly service: OpportunitiesService) {}
  @RequirePermission('opportunities.create', 'tenant')
  @Post()
  @ApiBody({ schema: openApiSchema(createOpportunitySchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(opportunityResponseSchema) })
  create(
    @CurrentTenant() context: TenantContext,
    @Body(new ZodPipe(createOpportunitySchema)) input: CreateOpportunity,
  ) {
    return this.service.create(context, input);
  }
  @RequirePermission('opportunities.read', 'tenant')
  @Get()
  @ApiListQuery(opportunityListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(opportunityListResponseSchema) })
  list(
    @CurrentTenant() context: TenantContext,
    @Query(new ZodPipe(opportunityListQuerySchema)) query: OpportunityListQuery,
  ) {
    return this.service.list(context, query);
  }
  @IdentityEndpoint()
  @Get('assignment-branches')
  @ApiListQuery(assignmentQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(assignmentListResponseSchema) })
  branches(
    @CurrentPrincipal() principal: Principal,
    @Query(new ZodPipe(assignmentQuerySchema)) query: AssignmentQuery,
  ) {
    return this.service.branches(principal, query);
  }
  @IdentityEndpoint()
  @Get('assignment-owners')
  @ApiListQuery(assignmentQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(assignmentListResponseSchema) })
  owners(
    @CurrentPrincipal() principal: Principal,
    @Query(new ZodPipe(assignmentQuerySchema)) query: AssignmentQuery,
  ) {
    return this.service.owners(principal, query);
  }
  @RequirePermission('opportunities.read', 'tenant')
  @Get(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(opportunityResponseSchema) })
  get(@CurrentTenant() context: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(context, id);
  }
  @RequirePermission('opportunities.update', 'tenant')
  @Patch(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateOpportunitySchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(opportunityResponseSchema) })
  update(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateOpportunitySchema)) input: UpdateOpportunity,
  ) {
    return this.service.update(context, id, input);
  }
  @RequirePermission('opportunities.delete', 'tenant')
  @Delete(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOperation({ summary: 'Deactivate; preserves record and relationships' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(opportunityResponseSchema) })
  archive(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archive(context, id, input.expectedVersion);
  }
  @RequirePermission('opportunities.move', 'tenant')
  @Post(':id/stage')
  @HttpCode(200)
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(moveOpportunitySchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(opportunityResponseSchema) })
  move(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(moveOpportunitySchema)) input: MoveOpportunity,
  ) {
    return this.service.move(context, id, input);
  }
  @RequirePermission('opportunities.read', 'tenant')
  @Get(':id/stage-history')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiListQuery(listQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(stageHistoryListResponseSchema) })
  history(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.service.history(context, id, query);
  }
}
