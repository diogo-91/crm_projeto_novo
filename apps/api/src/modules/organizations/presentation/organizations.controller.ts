import { CurrentPrincipal, CurrentTenant, RequirePermission } from '../../../common/security.js';
import type { Principal } from '../../../common/security.js';
import type { TenantContext } from '../../access-control/index.js';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import {
  problemResponseSchema,
  createOrganizationSchema,
  createBranchSchema,
  createOrganizationUserSchema,
  createMembershipSchema,
  uuidSchema,
  listQuerySchema,
  organizationResponseSchema,
  branchResponseSchema,
  membershipResponseSchema,
  branchListResponseSchema,
  memberListResponseSchema,
} from '@crm/contracts';
import type {
  CreateOrganization,
  CreateBranch,
  CreateOrganizationUser,
  CreateMembership,
  ListQuery,
} from '@crm/contracts';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { OrganizationsService } from '../application/organizations.service.js';
const problemContent = {
  'application/problem+json': { schema: openApiSchema(problemResponseSchema) },
};
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Bearer token required' })
@ApiResponse({ status: 403, description: 'Permission and scope required' })
@ApiTags('organizations')
@ApiResponse({ status: 400, description: 'Invalid input', content: problemContent })
@ApiResponse({ status: 404, description: 'Resource not found', content: problemContent })
@ApiResponse({
  status: 409,
  description: 'Unique conflict or inactive resource',
  content: problemContent,
})
@Controller('organizations')
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}
  @RequirePermission('organizations.create', 'platform')
  @Post()
  @ApiOperation({
    summary: 'Create organization with explicit platform permission; bootstrap creator membership',
  })
  @ApiBody({ schema: openApiSchema(createOrganizationSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(organizationResponseSchema) })
  create(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(createOrganizationSchema)) input: CreateOrganization,
  ) {
    return this.organizations.createOrganization(input, principal);
  }
  @RequirePermission('organizations.read')
  @Get(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(organizationResponseSchema) })
  get(@Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.organizations.getOrganization(id);
  }
  @RequirePermission('branches.manage', 'organization')
  @Post(':organizationId/branches')
  @ApiParam({ name: 'organizationId', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(createBranchSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(branchResponseSchema) })
  createBranch(
    @CurrentTenant() context: TenantContext,
    @Param('organizationId', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(createBranchSchema)) input: CreateBranch,
  ) {
    return this.organizations.createBranch(id, input, context);
  }
  @RequirePermission('branches.read', 'collection')
  @Get(':organizationId/branches')
  @ApiParam({ name: 'organizationId', schema: openApiSchema(uuidSchema) })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: openApiSchema(listQuerySchema.shape.limit),
  })
  @ApiQuery({ name: 'cursor', required: false, schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(branchListResponseSchema) })
  listBranches(
    @CurrentTenant() context: TenantContext,
    @Param('organizationId', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.organizations.listBranches(id, query, context);
  }
  @RequirePermission('users.manage', 'organization')
  @Post(':organizationId/users')
  @ApiParam({ name: 'organizationId', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(createOrganizationUserSchema, 'input') })
  @ApiCreatedResponse({
    description: 'New global identity and organization membership, atomically',
    schema: openApiSchema(membershipResponseSchema),
  })
  createUser(
    @CurrentTenant() context: TenantContext,
    @Param('organizationId', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(createOrganizationUserSchema)) input: CreateOrganizationUser,
  ) {
    return this.organizations.createUser(id, input, context);
  }
  @RequirePermission('users.read', 'collection')
  @Get(':organizationId/users')
  @ApiParam({ name: 'organizationId', schema: openApiSchema(uuidSchema) })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: openApiSchema(listQuerySchema.shape.limit),
  })
  @ApiQuery({ name: 'cursor', required: false, schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(memberListResponseSchema) })
  listUsers(
    @CurrentTenant() context: TenantContext,
    @Param('organizationId', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.organizations.listMembers(id, query, context);
  }
  @RequirePermission('users.manage', 'organization')
  @Post(':organizationId/memberships')
  @ApiParam({ name: 'organizationId', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(createMembershipSchema, 'input') })
  @ApiCreatedResponse({
    description:
      'Explicitly link an existing active global user; no lookup or association by email',
    schema: openApiSchema(membershipResponseSchema),
  })
  createMembership(
    @CurrentTenant() context: TenantContext,
    @Param('organizationId', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(createMembershipSchema)) input: CreateMembership,
  ) {
    return this.organizations.createMembership(id, input, context);
  }
}
