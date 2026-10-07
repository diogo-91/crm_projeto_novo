import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
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
} from '@nestjs/swagger';
import {
  createTaskSchema,
  updateTaskSchema,
  taskListQuerySchema,
  taskResponseSchema,
  taskListResponseSchema,
  archiveSchema,
  assignmentQuerySchema,
  assignmentListResponseSchema,
  uuidSchema,
  timelineQuerySchema,
  timelineResponseSchema,
  reminderStatusSchema,
  retryReminderResponseSchema,
} from '@crm/contracts';
import type {
  CreateTask,
  UpdateTask,
  TaskListQuery,
  AssignmentQuery,
  TimelineQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { TasksService } from '../application/tasks.service.js';
@ApiTags('tasks')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'Invalid input' })
@ApiResponse({ status: 401, description: 'Invalid session' })
@ApiResponse({ status: 403, description: 'Permission required' })
@ApiResponse({ status: 404, description: 'Unavailable or outside scope' })
@ApiResponse({ status: 409, description: 'Version conflict' })
@Controller('tasks')
export class TasksController {
  constructor(@Inject(TasksService) private readonly service: TasksService) {}
  @Post()
  @RequirePermission('tasks.create', 'tenant')
  @ApiBody({ schema: openApiSchema(createTaskSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(taskResponseSchema) })
  create(@CurrentTenant() c: TenantContext, @Body(new ZodPipe(createTaskSchema)) i: CreateTask) {
    return this.service.create(c, i);
  }
  @Get()
  @RequirePermission('tasks.read', 'tenant')
  @ApiListQuery(taskListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(taskListResponseSchema) })
  list(
    @CurrentTenant() c: TenantContext,
    @Query(new ZodPipe(taskListQuerySchema)) q: TaskListQuery,
  ) {
    return this.service.list(c, q);
  }
  @Get('assignment-branches')
  @RequirePermission('tasks.read', 'tenant')
  @ApiListQuery(assignmentQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(assignmentListResponseSchema) })
  branches(
    @CurrentTenant() c: TenantContext,
    @Query(new ZodPipe(assignmentQuerySchema)) q: AssignmentQuery,
  ) {
    return this.service.branches(c, q);
  }
  @Get('assignment-owners')
  @RequirePermission('tasks.read', 'tenant')
  @ApiListQuery(assignmentQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(assignmentListResponseSchema) })
  owners(
    @CurrentTenant() c: TenantContext,
    @Query(new ZodPipe(assignmentQuerySchema)) q: AssignmentQuery,
  ) {
    return this.service.owners(c, q);
  }
  @Get(':id/reminder')
  @RequirePermission('tasks.read', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: openApiSchema(reminderStatusSchema) })
  reminder(@CurrentTenant() c: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.reminder(c, id);
  }
  @Post(':id/reminder-retry')
  @HttpCode(200)
  @RequirePermission('tasks.update', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(retryReminderResponseSchema) })
  retry(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) i: { expectedVersion: number },
  ) {
    return this.service.retry(c, id, i.expectedVersion);
  }
  @Get(':id/history')
  @RequirePermission('tasks.read', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiListQuery(timelineQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(timelineResponseSchema) })
  history(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(timelineQuerySchema)) q: TimelineQuery,
  ) {
    return this.service.history(c, id, q);
  }
  @Get(':id')
  @RequirePermission('tasks.read', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: openApiSchema(taskResponseSchema) })
  get(@CurrentTenant() c: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(c, id);
  }
  @Patch(':id')
  @RequirePermission('tasks.update', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: openApiSchema(updateTaskSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(taskResponseSchema) })
  update(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateTaskSchema)) i: UpdateTask,
  ) {
    return this.service.change(c, id, i.expectedVersion, i);
  }
  @Delete(':id')
  @RequirePermission('tasks.delete', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(taskResponseSchema) })
  archive(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) i: { expectedVersion: number },
  ) {
    return this.service.change(c, id, i.expectedVersion, undefined, 'archive');
  }
  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermission('tasks.complete', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(taskResponseSchema) })
  complete(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) i: { expectedVersion: number },
  ) {
    return this.service.change(c, id, i.expectedVersion, undefined, 'complete');
  }
  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermission('tasks.complete', 'tenant')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(taskResponseSchema) })
  reopen(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) i: { expectedVersion: number },
  ) {
    return this.service.change(c, id, i.expectedVersion, undefined, 'reopen');
  }
}
