import {
    Column, CreateDateColumn,
    Entity, PrimaryGeneratedColumn
} from 'typeorm'

@Entity('deliveries')
export class DeliveryOrmEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ name: 'transaction_id' })
    transactionId: string

    @Column({ name: 'customer_id' })
    customerId: string

    @Column()
    address: string

    @Column()
    city: string

    @Column()
    department: string

    @Column({
        type: 'enum',
        enum: ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        default: 'PENDING',
    })
    status: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date
}