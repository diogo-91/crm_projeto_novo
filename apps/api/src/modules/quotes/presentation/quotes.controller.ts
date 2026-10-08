import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Inject,
  Headers,
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
  ApiHeader,
} from '@nestjs/swagger';
import {
  createQuoteSchema,
  updateQuoteSchema,
  quoteCommandSchema,
  quoteResponseSchema,
  quoteListResponseSchema,
  quoteQuerySchema,
  quoteHistoryResponseSchema,
  quoteHistoryQuerySchema,
  idempotencyKeySchema,
  uuidSchema,
  listQuerySchema,
  assignmentListResponseSchema,
} from '@crm/contracts';
import type {
  CreateQuote,
  UpdateQuote,
  QuoteQuery,
  QuoteHistoryQuery,
  ListQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { QuotesService } from '../application/quotes.service.js';
@ApiTags('quotes')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  description: 'Invalid input, missing idempotency key or expired quote',
})
@ApiResponse({ status: 401, description: 'Invalid session' })
@ApiResponse({ status: 403, description: 'Permission and scope required' })
@ApiResponse({ status: 404, description: 'Resource unavailable' })
@ApiResponse({
  status: 409,
  description: 'Concurrent change, immutable version or idempotency conflict',
})
@Controller('quotes')
export class QuotesController {
  constructor(@Inject(QuotesService) private readonly service: QuotesService) {}
  @Get('available-branches')
  @RequirePermission('quotes.create', 'tenant')
  @ApiListQuery(listQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(assignmentListResponseSchema) })
  branches(@CurrentTenant() c: TenantContext, @Query(new ZodPipe(listQuerySchema)) q: ListQuery) {
    return this.service.branches(c, q);
  }
  @Post()
  @RequirePermission('quotes.create', 'tenant')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: openApiSchema(idempotencyKeySchema),
  })
  @ApiBody({ schema: openApiSchema(createQuoteSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(quoteResponseSchema) })
  create(
    @CurrentTenant() c: TenantContext,
    @Body(new ZodPipe(createQuoteSchema)) input: CreateQuote,
    @Headers('idempotency-key') key: unknown,
  ) {
    return this.service.create(c, input, new ZodPipe(idempotencyKeySchema).transform(key));
  }
  @Get()
  @RequirePermission('quotes.read', 'tenant')
  @ApiListQuery(quoteQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(quoteListResponseSchema) })
  list(@CurrentTenant() c: TenantContext, @Query(new ZodPipe(quoteQuerySchema)) q: QuoteQuery) {
    return this.service.list(c, q);
  }
  @Get(':id')
  @RequirePermission('quotes.read', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(quoteResponseSchema) })
  get(@CurrentTenant() c: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.get(c, id);
  }
  @Get(':id/history')
  @ApiListQuery(quoteHistoryQuerySchema)
  @RequirePermission('quotes.read', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(quoteHistoryResponseSchema) })
  history(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(quoteHistoryQuerySchema)) q: QuoteHistoryQuery,
  ) {
    return this.service.history(c, id, q);
  }
  @Patch(':id')
  @RequirePermission('quotes.update', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateQuoteSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(quoteResponseSchema) })
  update(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateQuoteSchema)) input: UpdateQuote,
  ) {
    return this.service.update(c, id, input);
  }
  @Post(':id/approvals')
  @HttpCode(200)
  @RequirePermission('quotes.approve', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(quoteCommandSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(quoteResponseSchema) })
  approve(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(quoteCommandSchema)) input: { expectedVersion: number },
  ) {
    return this.service.approve(c, id, input.expectedVersion);
  }
  @Post(':id/revisions')
  @RequirePermission('quotes.create', 'tenant')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: openApiSchema(idempotencyKeySchema),
  })
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(quoteCommandSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(quoteResponseSchema) })
  revise(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(quoteCommandSchema)) input: { expectedVersion: number },
    @Headers('idempotency-key') key: unknown,
  ) {
    return this.service.revise(
      c,
      id,
      input.expectedVersion,
      new ZodPipe(idempotencyKeySchema).transform(key),
    );
  }
}
