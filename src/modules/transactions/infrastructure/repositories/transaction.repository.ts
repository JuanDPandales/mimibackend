import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../domain/transaction.entity';
import { ITransactionRepository } from '../../domain/transaction.repository';
import { TransactionOrmEntity } from '../entities/transaction.orm-entity';

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly repository: Repository<TransactionOrmEntity>,
  ) {}

  async create(transaction: Transaction): Promise<Transaction> {
    const ormEntity = this.repository.create({
      id: transaction.id,
      customerId: transaction.customerId,
      productId: transaction.productId,
      reference: transaction.reference,
      amountInCents: transaction.amountInCents,
      status: transaction.status,
      gatewayId: transaction.gatewayId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    });
    const savedEntity = await this.repository.save(ormEntity);
    return this.mapToDomain(savedEntity);
  }

  async findByReference(reference: string): Promise<Transaction | null> {
    const ormEntity = await this.repository.findOne({ where: { reference } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async updateStatus(
    reference: string,
    status: string,
    gatewayId?: string,
  ): Promise<void> {
    await this.repository.update({ reference }, { status, gatewayId });
  }

  private mapToDomain(ormEntity: TransactionOrmEntity): Transaction {
    return new Transaction(
      ormEntity.id,
      ormEntity.customerId,
      ormEntity.productId,
      ormEntity.reference,
      ormEntity.amountInCents,
      ormEntity.status as
        | 'PENDING'
        | 'APPROVED'
        | 'DECLINED'
        | 'VOIDED'
        | 'ERROR',
      ormEntity.gatewayId,
      ormEntity.createdAt,
      ormEntity.updatedAt,
    );
  }
}
