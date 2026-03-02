import {
    Column,
    Entity,
    JoinColumn, OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'
import { ProductOrmEntity } from '../../../products/infrastructure/entities/product.orm-entity'

@Entity('stock')
export class StockOrmEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ name: 'product_id' })
    productId: string

    @Column('int')
    quantity: number

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date

    @OneToOne(() => ProductOrmEntity, (product) => product.stock)
    @JoinColumn({ name: 'product_id' })
    product: ProductOrmEntity
}