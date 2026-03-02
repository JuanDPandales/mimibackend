import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockOrmEntity } from '../entities/stock.orm-entity';
import { IStockRepository } from '../../domain/stock.repository';
import { Stock } from '../../domain/stock.entity';

@Injectable()
export class StockRepository implements IStockRepository {
  constructor(
    @InjectRepository(StockOrmEntity)
    private readonly repository: Repository<StockOrmEntity>,
  ) {}

  async findByProductId(productId: string): Promise<Stock | null> {
    const ormEntity = await this.repository.findOne({ where: { productId } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  private mapToDomain(ormEntity: StockOrmEntity): Stock {
    return new Stock(
      ormEntity.id,
      ormEntity.productId,
      ormEntity.quantity,
      ormEntity.updatedAt,
    );
  }
}
