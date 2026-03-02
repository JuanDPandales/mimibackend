import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditLogger } from '../../../../shared/audit/audit.logger';
import { TransactionOrmEntity } from '../../infrastructure/entities/transaction.orm-entity';
import { StockOrmEntity } from '../../../../modules/stock/infrastructure/entities/stock.orm-entity';
import { DeliveryOrmEntity } from '../../../../modules/deliveries/infrastructure/entities/delivery.orm-entity';

export interface FinalizeTransactionInput {
  reference: string;
  status: string;
  gatewayId?: string;
}

@Injectable()
export class FinalizeTransactionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditLogger,
  ) { }

  async execute(input: FinalizeTransactionInput): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const transaction = await queryRunner.manager.findOne(TransactionOrmEntity, {
        where: { reference: input.reference },
      });

      if (!transaction) {
        this.audit.warn({
          event: 'TRANSACTION_ERROR',
          reference: input.reference,
          metadata: { reason: 'Transaction not found during finalization' },
        });
        await queryRunner.rollbackTransaction();
        return;
      }

      // If already finalized, skip
      if (transaction.status === 'APPROVED' || transaction.status === 'DECLINED' || transaction.status === 'ERROR') {
        await queryRunner.rollbackTransaction();
        return;
      }

      const prevStatus = transaction.status;
      transaction.status = input.status;
      transaction.gatewayId = input.gatewayId || transaction.gatewayId;
      transaction.updatedAt = new Date();

      await queryRunner.manager.save(TransactionOrmEntity, transaction);

      if (input.status === 'APPROVED') {
        // 1. Update Stock
        await queryRunner.manager.decrement(
          StockOrmEntity,
          { productId: transaction.productId },
          'quantity',
          1,
        );

        // 2. Update Delivery status from AWAITING_PAYMENT to PENDING
        await queryRunner.manager.update(
          DeliveryOrmEntity,
          { transactionId: transaction.id },
          { status: 'PENDING' },
        );

        this.audit.log({
          event: 'TRANSACTION_APPROVED',
          transactionId: transaction.id,
          reference: transaction.reference,
          gatewayId: transaction.gatewayId || undefined,
        });
      } else if (input.status === 'DECLINED' || input.status === 'ERROR') {
        // Update Delivery status to CANCELLED
        await queryRunner.manager.update(
          DeliveryOrmEntity,
          { transactionId: transaction.id },
          { status: 'CANCELLED' },
        );

        this.audit.warn({
          event: 'TRANSACTION_DECLINED',
          transactionId: transaction.id,
          reference: transaction.reference,
          gatewayId: transaction.gatewayId || undefined,
        });
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.audit.error({
        event: 'TRANSACTION_ERROR',
        reference: input.reference,
        error: error instanceof Error ? error.message : 'Unknown error during finalization',
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
