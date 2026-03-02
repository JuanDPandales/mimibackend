import { StockOrmEntity } from '../../../stock/infrastructure/entities/stock.orm-entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

@Entity('products')
export class ProductOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('int')
  price: number;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column()
  category: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => StockOrmEntity, (stock) => stock.product)
  stock: StockOrmEntity;
}
