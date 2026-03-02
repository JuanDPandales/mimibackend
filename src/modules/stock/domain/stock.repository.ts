import { Stock } from './stock.entity';

export const STOCK_REPOSITORY = 'STOCK_REPOSITORY';

export interface IStockRepository {
  findByProductId(productId: string): Promise<Stock | null>;
}
