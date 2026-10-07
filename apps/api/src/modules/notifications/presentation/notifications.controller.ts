import { Controller, Get, Post, Param, Query, Inject, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  notificationQuerySchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  uuidSchema,
} from '@crm/contracts';
import type { NotificationQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { NotificationsService } from '../application/notifications.service.js';
@ApiTags('notifications')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Invalid session' })
@ApiResponse({ status: 403, description: 'Permission required' })
@ApiResponse({ status: 404, description: 'Notification unavailable' })
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly service: NotificationsService) {}
  @Get()
  @RequirePermission('notifications.read', 'tenant')
  @ApiListQuery(notificationQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(notificationListResponseSchema) })
  list(
    @CurrentTenant() c: TenantContext,
    @Query(new ZodPipe(notificationQuerySchema)) q: NotificationQuery,
  ) {
    return this.service.list(c, q);
  }
  @Post(':id/read')
  @HttpCode(200)
  @RequirePermission('notifications.update', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: openApiSchema(notificationResponseSchema) })
  read(@CurrentTenant() c: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.read(c, id);
  }
}
