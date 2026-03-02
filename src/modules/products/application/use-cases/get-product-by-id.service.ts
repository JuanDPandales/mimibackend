import { Inject, Injectable } from '@nestjs/common';
import {
  err,
  NotFoundError,
  ok,
  Result,
} from '../../../../shared/result/result';
import {
  type IStockRepository,
  STOCK_REPOSITORY,
} from '../../../stock/domain/stock.repository';
import {
  type IProductRepository,
  PRODUCT_REPOSITORY,
} from '../../domain/product.repository';
import { ProductWithStock } from './get-products.service';

@Injectable()
export class GetProductByIdUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
    @Inject(STOCK_REPOSITORY) private readonly stockRepo: IStockRepository,
  ) {}

  async execute(id: string): Promise<Result<ProductWithStock>> {
    const product = await this.productRepo.findById(id);
    if (!product) return err(new NotFoundError('Product'));
    const stock = await this.stockRepo.findByProductId(id);
    return ok({ ...product, stock: stock?.quantity ?? 0 });
  }
}
