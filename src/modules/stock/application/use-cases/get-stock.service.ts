import { Injectable, Inject } from '@nestjs/common';
import {
  Result,
  ok,
  err,
  NotFoundError,
} from '../../../../shared/result/result';
import { Stock } from '../../domain/stock.entity';
import {
  STOCK_REPOSITORY,
  type IStockRepository,
} from '../../domain/stock.repository';

@Injectable()
export class GetStockUseCase {
  constructor(
    @Inject(STOCK_REPOSITORY) private readonly stockRepo: IStockRepository,
  ) {}

  async execute(productId: string): Promise<Result<Stock>> {
    const stock = await this.stockRepo.findByProductId(productId);
    if (!stock) {
      return err(new NotFoundError(`Stock not found for product ${productId}`));
    }
    return ok(stock);
  }
}
