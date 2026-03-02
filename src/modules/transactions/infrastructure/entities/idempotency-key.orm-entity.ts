import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKeyOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key: string;

  @Column({ type: 'jsonb' })
  response: any;

  @Column({ type: 'int' })
  statusCode: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
