import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transactions')
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ unique: true })
  reference: string;

  @Column({ name: 'amount_in_cents', type: 'bigint' })
  amountInCents: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'],
    default: 'PENDING',
  })
  status: string;

  @Column({ name: 'gateway_id', nullable: true, type: 'varchar' })
  gatewayId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
