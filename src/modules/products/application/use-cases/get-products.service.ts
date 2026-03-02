import { Inject, Injectable } from '@nestjs/common';
import { Result, ok } from '../../../../shared/result/result';
import {
  type IStockRepository,
  STOCK_REPOSITORY,
} from '../../../stock/domain/stock.repository';
import { Product } from '../../domain/product.entity';
import {
  type IProductRepository,
  PRODUCT_REPOSITORY,
} from '../../domain/product.repository';

export interface ProductWithStock extends Product {
  stock: number;
}

@Injectable()
export class GetProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
    @Inject(STOCK_REPOSITORY) private readonly stockRepo: IStockRepository,
  ) {}

  async execute(): Promise<Result<ProductWithStock[]>> {
    const products = await this.productRepo.findAll();
    const withStock: ProductWithStock[] = await Promise.all(
      products.map(async (p: Product) => {
        const stock = await this.stockRepo.findByProductId(p.id);
        return { ...p, stock: stock?.quantity ?? 0 };
      }),
    );
    return ok(withStock);
  }
}
