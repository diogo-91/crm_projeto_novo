import { Body, Controller, Get, Post, Param, Query, Inject } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import {
  createActivitySchema,
  activityResponseSchema,
  targetTypeSchema,
  uuidSchema,
  timelineQuerySchema,
  timelineResponseSchema,
} from '@crm/contracts';
import type { CreateActivity, ResourceTarget, TimelineQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { ActivitiesService } from '../application/activities.service.js';
@ApiTags('activities')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'Invalid input' })
@ApiResponse({ status: 401, description: 'Invalid session' })
@ApiResponse({ status: 403, description: 'Outside scope' })
@ApiResponse({ status: 404, description: 'Target unavailable' })
@Controller('activities')
export class ActivitiesController {
  constructor(@Inject(ActivitiesService) private readonly service: ActivitiesService) {}
  @Post()
  @RequirePermission('activities.create', 'tenant')
  @ApiBody({ schema: openApiSchema(createActivitySchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(activityResponseSchema) })
  create(
    @CurrentTenant() c: TenantContext,
    @Body(new ZodPipe(createActivitySchema)) i: CreateActivity,
  ) {
    return this.service.create(c, i);
  }
  @Get(':type/:id/timeline')
  @RequirePermission('activities.read', 'tenant')
  @ApiParam({ name: 'type', enum: ['contact', 'lead', 'opportunity'] })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiListQuery(timelineQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(timelineResponseSchema) })
  timeline(
    @CurrentTenant() c: TenantContext,
    @Param('type', new ZodPipe(targetTypeSchema)) type: ResourceTarget['type'],
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(timelineQuerySchema)) q: TimelineQuery,
  ) {
    return this.service.timeline(c, { type, id }, q);
  }
}
