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
  createContactSchema,
  updateContactSchema,
  contactListQuerySchema,
  contactListResponseSchema,
  contactResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
  assignmentQuerySchema,
  assignmentListResponseSchema,
} from '@crm/contracts';
import type {
  CreateContact,
  UpdateContact,
  ContactListQuery,
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
import { ContactsService } from '../application/contacts.service.js';
@ApiTags('contacts')
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
@Controller('contacts')
export class ContactsController {
  constructor(@Inject(ContactsService) private readonly service: ContactsService) {}
  @RequirePermission('contacts.create', 'tenant')
  @Post()
  @ApiBody({ schema: openApiSchema(createContactSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(contactResponseSchema) })
  create(
    @CurrentTenant() context: TenantContext,
    @Body(new ZodPipe(createContactSchema)) input: CreateContact,
  ) {
    return this.service.create(context, input);
  }
  @RequirePermission('contacts.read', 'tenant')
  @Get()
  @ApiListQuery(contactListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(contactListResponseSchema) })
  list(
    @CurrentTenant() context: TenantContext,
    @Query(new ZodPipe(contactListQuerySchema)) query: ContactListQuery,
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
  @RequirePermission('contacts.read', 'tenant')
  @Get(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(contactResponseSchema) })
  get(@CurrentTenant() context: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(context, id);
  }
  @RequirePermission('contacts.update', 'tenant')
  @Patch(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateContactSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(contactResponseSchema) })
  update(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateContactSchema)) input: UpdateContact,
  ) {
    return this.service.update(context, id, input);
  }
  @RequirePermission('contacts.delete', 'tenant')
  @Delete(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOperation({ summary: 'Deactivate; preserves record and relationships' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(contactResponseSchema) })
  archive(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archive(context, id, input.expectedVersion);
  }
}
