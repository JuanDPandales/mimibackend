import { Module } from '@nestjs/common';
import { StockController } from './presentation/stock.controller';
import { GetStockService } from './application/use-cases/get-stock.service';

@Module({
  controllers: [StockController],
  providers: [GetStockService]
})
export class StockModule {}
