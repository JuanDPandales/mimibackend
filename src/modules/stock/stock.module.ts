import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetStockUseCase } from './application/use-cases/get-stock.service';
import { STOCK_REPOSITORY } from './domain/stock.repository';
import { StockOrmEntity } from './infrastructure/entities/stock.orm-entity';
import { StockRepository } from './infrastructure/repositories/stock.repository';
import { StockController } from './presentation/stock.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StockOrmEntity])],
  controllers: [StockController],
  providers: [
    GetStockUseCase,
    {
      provide: STOCK_REPOSITORY,
      useClass: StockRepository,
    },
  ],
  exports: [STOCK_REPOSITORY],
})
export class StockModule { }
