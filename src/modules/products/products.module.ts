import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetProductByIdUseCase } from './application/use-cases/get-product-by-id.service';
import { GetProductsUseCase } from './application/use-cases/get-products.service';
import { PRODUCT_REPOSITORY } from './domain/product.repository';
import { ProductOrmEntity } from './infrastructure/entities/product.orm-entity';
import { ProductRepository } from './infrastructure/repositories/product.repository';
import { ProductsController } from './presentation/products.controller';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductOrmEntity]),
    forwardRef(() => StockModule),
  ],
  controllers: [ProductsController],
  providers: [
    GetProductsUseCase,
    GetProductByIdUseCase,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: ProductRepository,
    },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductsModule { }
