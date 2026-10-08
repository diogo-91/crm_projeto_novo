import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateProduct,
  UpdateProduct,
  ProductListQuery,
  CreatePriceList,
  UpdatePriceList,
  PriceListQuery,
  PriceItemQuery,
  SetPrice,
  ListQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { ProductsRepository } from '../infrastructure/products.repository.js';
import { PriceListsRepository } from '../infrastructure/price-lists.repository.js';
@Injectable()
export class CatalogService {
  constructor(
    @Inject(ProductsRepository) private readonly products: ProductsRepository,
    @Inject(PriceListsRepository) private readonly lists: PriceListsRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  productsList(c: TenantContext, q: ProductListQuery) {
    return this.products.list(c, q);
  }
  product(c: TenantContext, id: string) {
    return this.products.get(c, id);
  }
  async createProduct(c: TenantContext, input: CreateProduct) {
    const result = await this.products.create(c, input);
    this.log(c, 'products.create', result.id);
    return result;
  }
  async updateProduct(c: TenantContext, id: string, input: UpdateProduct) {
    const result = await this.products.update(c, id, input);
    this.log(c, 'products.update', id);
    return result;
  }
  async archiveProduct(c: TenantContext, id: string, version: number) {
    const result = await this.products.archive(c, id, version);
    this.log(c, 'products.archive', id);
    return result;
  }
  priceBranches(c: TenantContext, q: ListQuery) {
    return this.lists.branches(c, q);
  }
  priceLists(c: TenantContext, q: PriceListQuery) {
    return this.lists.list(c, q);
  }
  priceList(c: TenantContext, id: string) {
    return this.lists.get(c, id);
  }
  prices(c: TenantContext, id: string, q: PriceItemQuery) {
    return this.lists.items(c, id, q);
  }
  async createPriceList(c: TenantContext, input: CreatePriceList) {
    const result = await this.lists.create(c, input);
    this.log(c, 'price-lists.create', result.id);
    return result;
  }
  async updatePriceList(c: TenantContext, id: string, input: UpdatePriceList) {
    const result = await this.lists.update(c, id, input);
    this.log(c, 'price-lists.update', id);
    return result;
  }
  async archivePriceList(c: TenantContext, id: string, version: number) {
    const result = await this.lists.archive(c, id, version);
    this.log(c, 'price-lists.archive', id);
    return result;
  }
  async setPrice(c: TenantContext, id: string, productId: string, input: SetPrice) {
    const result = await this.lists.setPrice(c, id, productId, input);
    this.log(c, 'price-lists.set-price', id);
    return result;
  }
  async removePrice(c: TenantContext, id: string, productId: string, version: number) {
    const result = await this.lists.removePrice(c, id, productId, version);
    this.log(c, 'price-lists.remove-price', id);
    return result;
  }
  private log(c: TenantContext, event: string, id: string) {
    this.logger.info(event, 'catalog', {
      organizationId: c.organizationId,
      membershipId: c.membershipId,
      entityId: id,
    });
  }
}
