import type { Principal } from '../../../common/security.js';
import { Body, Controller, Get, Post, Patch, Delete, Query, Param, Inject } from '@nestjs/common';
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
  createCompanySchema,
  updateCompanySchema,
  companyListQuerySchema,
  companyListResponseSchema,
  companyResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
  assignmentQuerySchema,
  assignmentListResponseSchema,
} from '@crm/contracts';
import type {
  CreateCompany,
  UpdateCompany,
  CompanyListQuery,
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
import { CompaniesService } from '../application/companies.service.js';
@ApiTags('companies')
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
@Controller('companies')
export class CompaniesController {
  constructor(@Inject(CompaniesService) private readonly service: CompaniesService) {}
  @RequirePermission('companies.create', 'tenant')
  @Post()
  @ApiBody({ schema: openApiSchema(createCompanySchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(companyResponseSchema) })
  create(
    @CurrentTenant() context: TenantContext,
    @Body(new ZodPipe(createCompanySchema)) input: CreateCompany,
  ) {
    return this.service.create(context, input);
  }
  @RequirePermission('companies.read', 'tenant')
  @Get()
  @ApiListQuery(companyListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(companyListResponseSchema) })
  list(
    @CurrentTenant() context: TenantContext,
    @Query(new ZodPipe(companyListQuerySchema)) query: CompanyListQuery,
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
  @RequirePermission('companies.read', 'tenant')
  @Get(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(companyResponseSchema) })
  get(@CurrentTenant() context: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(context, id);
  }
  @RequirePermission('companies.update', 'tenant')
  @Patch(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateCompanySchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(companyResponseSchema) })
  update(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateCompanySchema)) input: UpdateCompany,
  ) {
    return this.service.update(context, id, input);
  }
  @RequirePermission('companies.delete', 'tenant')
  @Delete(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOperation({ summary: 'Deactivate; preserves record and relationships' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(companyResponseSchema) })
  archive(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archive(context, id, input.expectedVersion);
  }
}
