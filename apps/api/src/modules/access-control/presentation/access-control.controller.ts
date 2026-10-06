import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import {
  assignRoleSchema,
  uuidSchema,
  roleListResponseSchema,
  permissionListResponseSchema,
  assignmentResponseSchema,
} from '@crm/contracts';
import type { AssignRole } from '@crm/contracts';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import type { TenantContext } from '../domain/access-policy.js';
import { AccessControlService } from '../application/access-control.service.js';
@ApiTags('access-control')
@ApiBearerAuth()
@Controller('organizations/:organizationId')
export class AccessControlController {
  constructor(@Inject(AccessControlService) private readonly access: AccessControlService) {}
  @Get('roles')
  @RequirePermission('roles.read')
  @ApiOkResponse({ schema: openApiSchema(roleListResponseSchema) })
  roles(@CurrentTenant() context: TenantContext) {
    return this.access.listRoles(context);
  }
  @Get('permissions')
  @RequirePermission('roles.read')
  @ApiOkResponse({ schema: openApiSchema(permissionListResponseSchema) })
  permissions() {
    return this.access.listPermissions();
  }
  @Post('memberships/:membershipId/roles')
  @RequirePermission('users.manage')
  @ApiBody({ schema: openApiSchema(assignRoleSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(assignmentResponseSchema) })
  assign(
    @CurrentTenant() context: TenantContext,
    @Param('membershipId', new ZodPipe(uuidSchema)) memberId: string,
    @Body(new ZodPipe(assignRoleSchema)) input: AssignRole,
  ) {
    return this.access.assign(context, memberId, input);
  }
  @Delete('memberships/:membershipId/roles/:assignmentId')
  @HttpCode(204)
  @RequirePermission('users.manage')
  @ApiNoContentResponse()
  remove(
    @CurrentTenant() context: TenantContext,
    @Param('membershipId', new ZodPipe(uuidSchema)) memberId: string,
    @Param('assignmentId', new ZodPipe(uuidSchema)) assignmentId: string,
  ) {
    return this.access.remove(context, memberId, assignmentId);
  }
}
