import { Module } from '@nestjs/common';
import { ProductsController } from './presentation/products.controller';
import { GetProductsService } from './application/use-cases/get-products.service';
import { GetProductByIdService } from './application/use-cases/get-product-by-id.service';

@Module({
  controllers: [ProductsController],
  providers: [GetProductsService, GetProductByIdService]
})
export class ProductsModule {}
