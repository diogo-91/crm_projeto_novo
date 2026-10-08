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
  createProductSchema,
  updateProductSchema,
  productResponseSchema,
  productListQuerySchema,
  productListResponseSchema,
  uuidSchema,
  archiveSchema,
  problemResponseSchema,
} from '@crm/contracts';
import type { CreateProduct, UpdateProduct, ProductListQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { CurrentTenant, RequirePermission } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { ApiListQuery } from '../../../common/api-list-query.js';
import { CatalogService } from '../application/catalog.service.js';
@ApiTags('products')
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
@Controller('products')
export class ProductsController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Post()
  @RequirePermission('products.manage', 'tenant')
  @ApiBody({ schema: openApiSchema(createProductSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(productResponseSchema) })
  create(
    @CurrentTenant() c: TenantContext,
    @Body(new ZodPipe(createProductSchema)) input: CreateProduct,
  ) {
    return this.service.createProduct(c, input);
  }
  @Get()
  @RequirePermission('products.read', 'tenant')
  @ApiListQuery(productListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(productListResponseSchema) })
  list(
    @CurrentTenant() c: TenantContext,
    @Query(new ZodPipe(productListQuerySchema)) q: ProductListQuery,
  ) {
    return this.service.productsList(c, q);
  }
  @Get(':id')
  @RequirePermission('products.read', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiOkResponse({ schema: openApiSchema(productResponseSchema) })
  get(@CurrentTenant() c: TenantContext, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.service.product(c, id);
  }
  @Patch(':id')
  @RequirePermission('products.manage', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(updateProductSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(productResponseSchema) })
  update(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateProductSchema)) input: UpdateProduct,
  ) {
    return this.service.updateProduct(c, id, input);
  }
  @Delete(':id')
  @RequirePermission('products.manage', 'tenant')
  @ApiParam({ name: 'id', schema: openApiSchema(uuidSchema) })
  @ApiBody({ schema: openApiSchema(archiveSchema) })
  @ApiOkResponse({ schema: openApiSchema(productResponseSchema) })
  @ApiOperation({ summary: 'Archive; preserves record and references' })
  archive(
    @CurrentTenant() c: TenantContext,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveSchema)) input: { expectedVersion: number },
  ) {
    return this.service.archiveProduct(c, id, input.expectedVersion);
  }
}
