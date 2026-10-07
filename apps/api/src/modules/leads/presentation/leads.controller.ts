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
  conversionSchema,
  conversionResponseSchema,
  createLeadSchema,
  updateLeadSchema,
  leadListQuerySchema,
  leadListResponseSchema,
  leadResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
  assignmentQuerySchema,
  assignmentListResponseSchema,
} from '@crm/contracts';
import type {
  ConvertLead,
  CreateLead,
  UpdateLead,
  LeadListQuery,
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
import { LeadsService } from '../application/leads.service.js';
@ApiTags('leads')
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
@Controller('leads')
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly service: LeadsService) {}
  @RequirePermission('leads.create', 'tenant')
  @Post()
  @ApiBody({ schema: openApiSchema(createLeadSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(leadResponseSchema) })
  create(
    @CurrentTenant() context: TenantContext,
    @Body(new ZodPipe(createLeadSchema)) input: CreateLead,
  ) {
    return this.service.create(context, input);
  }
  @RequirePermission('leads.read', 'tenant')
  @Get()
  @ApiListQuery(leadListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(leadListResponseSchema) })
  list(
    @CurrentTenant() context: TenantContext,
    @Query(new ZodPipe(leadListQuerySchema)) query: LeadListQuery,
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
  @RequirePermission('leads.read', 'tenant')
  @Get(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(leadResponseSchema) })
  get(@CurrentTenant() context: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(context, id);
  }
  @RequirePermission('leads.update', 'tenant')
  @Patch(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateLeadSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(leadResponseSchema) })
  update(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateLeadSchema)) input: UpdateLead,
  ) {
    return this.service.update(context, id, input);
  }
  @RequirePermission('leads.delete', 'tenant')
  @Delete(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOperation({ summary: 'Deactivate; preserves record and relationships' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(leadResponseSchema) })
  archive(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archive(context, id, input.expectedVersion);
  }
  @RequirePermission('leads.convert', 'tenant')
  @Post(':id/convert')
  @HttpCode(200)
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(conversionSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(conversionResponseSchema) })
  convert(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(conversionSchema)) input: ConvertLead,
  ) {
    return this.service.convert(context, id, input);
  }
}
