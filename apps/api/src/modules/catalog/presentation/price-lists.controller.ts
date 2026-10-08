import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Query,
  Param,
  Inject,
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
  createPriceListSchema,
  updatePriceListSchema,
  priceListResponseSchema,
  priceListQuerySchema,
  priceListListResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
  priceItemQuerySchema,
  priceItemListResponseSchema,
  setPriceSchema,
  listQuerySchema,
  priceBranchOptionsSchema,
} from '@crm/contracts';
import type {
  CreatePriceList,
  UpdatePriceList,
  PriceListQuery,
  PriceItemQuery,
  SetPrice,
  ListQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { CatalogService } from '../application/catalog.service.js';
@ApiTags('price-lists')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  description: 'Invalid input',
  content: { 'application/problem+json': { schema: openApiSchema(problemResponseSchema) } },
})
@ApiResponse({ status: 401, description: 'Invalid session' })
@ApiResponse({ status: 403, description: 'Permission and scope required' })
@ApiResponse({ status: 404, description: 'Resource unavailable' })
@ApiResponse({ status: 409, description: 'Duplicate, archived or concurrent change' })
@Controller('price-lists')
export class PriceListsController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Post()
  @RequirePermission('price-lists.manage', 'tenant')
  @ApiBody({ schema: openApiSchema(createPriceListSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(priceListResponseSchema) })
  create(
    @CurrentTenant() c: TenantContext,
    @Body(new ZodPipe(createPriceListSchema)) input: CreatePriceList,
  ) {
    return this.service.createPriceList(c, input);
  }
  @Get()
  @RequirePermission('price-lists.read', 'tenant')
  @ApiListQuery(priceListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(priceListListResponseSchema) })
  list(
    @CurrentTenant() c: TenantContext,
    @Query(new ZodPipe(priceListQuerySchema)) q: PriceListQuery,
  ) {
    return this.service.priceLists(c, q);
  }
  @Get('available-branches')
  @RequirePermission('price-lists.manage', 'tenant')
  @ApiListQuery(listQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(priceBranchOptionsSchema) })
  branches(@CurrentTenant() c: TenantContext, @Query(new ZodPipe(listQuerySchema)) q: ListQuery) {
    return this.service.priceBranches(c, q);
  }
  @Get(':id')
  @RequirePermission('price-lists.read', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(priceListResponseSchema) })
  get(@CurrentTenant() c: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.priceList(c, id);
  }
  @Patch(':id')
  @RequirePermission('price-lists.manage', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updatePriceListSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(priceListResponseSchema) })
  update(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updatePriceListSchema)) input: UpdatePriceList,
  ) {
    return this.service.updatePriceList(c, id, input);
  }
  @Delete(':id')
  @RequirePermission('price-lists.manage', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(priceListResponseSchema) })
  @ApiOperation({ summary: 'Archive; preserves record and references' })
  archive(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archivePriceList(c, id, input.expectedVersion);
  }

  @Get(':id/items')
  @RequirePermission('price-lists.read', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiListQuery(priceItemQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(priceItemListResponseSchema) })
  items(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(priceItemQuerySchema)) q: PriceItemQuery,
  ) {
    return this.service.prices(c, id, q);
  }
  @Put(':id/items/:productId')
  @RequirePermission('price-lists.manage', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiParam({ name: 'productId', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(setPriceSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(priceListResponseSchema) })
  price(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Param('productId', new ZodPipe(uuidSchema)) productId: string,
    @Body(new ZodPipe(setPriceSchema)) input: SetPrice,
  ) {
    return this.service.setPrice(c, id, productId, input);
  }
  @Delete(':id/items/:productId')
  @RequirePermission('price-lists.manage', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiParam({ name: 'productId', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(priceListResponseSchema) })
  @ApiOperation({ summary: 'Deactivate a price; preserves references' })
  remove(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Param('productId', new ZodPipe(uuidSchema)) productId: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.removePrice(c, id, productId, input.expectedVersion);
  }
}
