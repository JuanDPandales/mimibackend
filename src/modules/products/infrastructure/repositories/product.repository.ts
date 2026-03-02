import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../domain/product.entity';
import { IProductRepository } from '../../domain/product.repository';
import { ProductOrmEntity } from '../entities/product.orm-entity';

@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(ProductOrmEntity)
    private readonly repository: Repository<ProductOrmEntity>,
  ) {}

  async findAll(): Promise<Product[]> {
    const ormEntities = await this.repository.find();
    return ormEntities.map((ormEntity) => this.mapToDomain(ormEntity));
  }

  async findById(id: string): Promise<Product | null> {
    const ormEntity = await this.repository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  private mapToDomain(ormEntity: ProductOrmEntity): Product {
    return {
      id: ormEntity.id,
      name: ormEntity.name,
      description: ormEntity.description,
      price: ormEntity.price,
      imageUrl: ormEntity.imageUrl,
      category: ormEntity.category,
      createdAt: ormEntity.createdAt,
    };
  }
}
