import { CatalogLookupGateway } from './infrastructure/catalog-lookup.gateway.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { ProductsRepository } from './infrastructure/products.repository.js';
import { PriceListsRepository } from './infrastructure/price-lists.repository.js';
import { CatalogService } from './application/catalog.service.js';
import { ProductsController } from './presentation/products.controller.js';
import { PriceListsController } from './presentation/price-lists.controller.js';
@Module({
  imports: [DatabaseModule, AccessControlModule, OrganizationsContextModule],
  controllers: [ProductsController, PriceListsController],
  exports: [CatalogLookupGateway],
  providers: [CatalogLookupGateway, ProductsRepository, PriceListsRepository, CatalogService],
})
export class CatalogModule {}
