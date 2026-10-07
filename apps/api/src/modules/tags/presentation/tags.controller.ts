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
  createTagSchema,
  updateTagSchema,
  tagListQuerySchema,
  tagListResponseSchema,
  tagResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
} from '@crm/contracts';
import type { CreateTag, UpdateTag, TagListQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { TagsService } from '../application/tags.service.js';
@ApiTags('tags')
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
@Controller('tags')
export class TagsController {
  constructor(@Inject(TagsService) private readonly service: TagsService) {}
  @RequirePermission('tags.manage', 'tenant')
  @Post()
  @ApiBody({ schema: openApiSchema(createTagSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(tagResponseSchema) })
  create(
    @CurrentTenant() context: TenantContext,
    @Body(new ZodPipe(createTagSchema)) input: CreateTag,
  ) {
    return this.service.create(context, input);
  }
  @RequirePermission('tags.read', 'tenant')
  @Get()
  @ApiListQuery(tagListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(tagListResponseSchema) })
  list(
    @CurrentTenant() context: TenantContext,
    @Query(new ZodPipe(tagListQuerySchema)) query: TagListQuery,
  ) {
    return this.service.list(context, query);
  }
  @RequirePermission('tags.manage', 'tenant')
  @Patch(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateTagSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(tagResponseSchema) })
  update(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateTagSchema)) input: UpdateTag,
  ) {
    return this.service.update(context, id, input);
  }
  @RequirePermission('tags.manage', 'tenant')
  @Delete(':id')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOperation({ summary: 'Deactivate; preserves record and relationships' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(tagResponseSchema) })
  archive(
    @CurrentTenant() context: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archive(context, id, input.expectedVersion);
  }
}
