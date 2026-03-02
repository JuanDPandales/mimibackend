import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../../modules/customers/infrastructure/repositories/customer.repository';
import { DeliveryOrmEntity } from '../../../../modules/deliveries/infrastructure/entities/delivery.orm-entity';
import {
  DELIVERY_REPOSITORY,
  type IDeliveryRepository,
} from '../../../../modules/deliveries/infrastructure/repositories/delivery.repository';
import { StockOrmEntity } from '../../../../modules/stock/infrastructure/entities/stock.orm-entity';
import { AuditLogger } from '../../../../shared/audit/audit.logger';
import { PaymentGatewayService } from '../../../../shared/payment-gateway/payment-gateway.service';
import {
  err,
  InternalServerError,
  NotFoundError,
  ok,
  OutOfStockError,
  Result,
} from '../../../../shared/result/result';
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from '../../../products/domain/product.repository';
import {
  STOCK_REPOSITORY,
  type IStockRepository,
} from '../../../stock/domain/stock.repository';
import { Transaction } from '../../domain/transaction.entity';
import {
  TRANSACTION_REPOSITORY,
  type ITransactionRepository,
} from '../../domain/transaction.repository';
import { TransactionOrmEntity } from '../../infrastructure/entities/transaction.orm-entity';
import { FinalizeTransactionService } from './finalize-transaction.service';

export interface ProcessPaymentInput {
  productId: string;
  cardToken: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDepartment: string;
  ip?: string;
  userAgent?: string;
}

export interface ProcessPaymentOutput {
  transactionId: string;
  reference: string;
  status: string;
  gatewayId: string | null;
  amountInCents: number;
}

@Injectable()
export class ProcessPaymentService {
  private readonly baseFee: number;
  private readonly deliveryFee: number;

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly txRepo: ITransactionRepository,
    @Inject(STOCK_REPOSITORY) private readonly stockRepo: IStockRepository,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveryRepo: IDeliveryRepository,
    private readonly gateway: PaymentGatewayService,
    private readonly finalizeTransaction: FinalizeTransactionService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditLogger,
  ) {
    this.baseFee =
      Number(this.config.get<number>('payment.baseFee', 0)) || 3500;
    this.deliveryFee =
      Number(this.config.get<number>('payment.deliveryFee', 0)) || 8000;
  }

  async execute(
    input: ProcessPaymentInput,
  ): Promise<Result<ProcessPaymentOutput>> {
    const queryRunner1 = this.dataSource.createQueryRunner();

    try {
      const product = await this.productRepo.findById(input.productId);
      if (!product) {
        return err(new NotFoundError('Product'));
      }

      const customer = await this.customerRepo.upsertByEmail({
        name: input.customerName,
        email: input.customerEmail,
        phone: input.customerPhone,
      });

      const totalInPesos = product.price + this.baseFee + this.deliveryFee;
      const amountInCents = totalInPesos * 100;
      const reference = crypto.randomUUID();

      await queryRunner1.connect();
      await queryRunner1.startTransaction('SERIALIZABLE');

      let pendingTransaction: Transaction;

      try {
        const stockRecord = await queryRunner1.manager
          .createQueryBuilder(StockOrmEntity, 'stock')
          .where('stock.productId = :productId', {
            productId: input.productId,
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!stockRecord || stockRecord.quantity <= 0) {
          try {
            await queryRunner1.rollbackTransaction();
          } catch (rollbackError) {
            this.audit.error({
              event: 'TRANSACTION_ERROR',
              error:
                rollbackError instanceof Error
                  ? rollbackError.message
                  : 'Unknown',
            });
          }
          return err(new OutOfStockError());
        }

        pendingTransaction = new Transaction(
          crypto.randomUUID(),
          customer.id,
          product.id,
          reference,
          amountInCents,
          'PENDING',
          null,
          new Date(),
          new Date(),
        );

        const txOrmEntity = queryRunner1.manager.create(TransactionOrmEntity, {
          id: pendingTransaction.id,
          customerId: customer.id,
          productId: product.id,
          reference: pendingTransaction.reference,
          amountInCents: pendingTransaction.amountInCents,
          status: 'PENDING' as const,
        });
        await queryRunner1.manager.save(TransactionOrmEntity, txOrmEntity);

        const deliveryRecord = queryRunner1.manager.create(DeliveryOrmEntity, {
          id: crypto.randomUUID(),
          transactionId: pendingTransaction.id,
          customerId: customer.id,
          address: input.deliveryAddress,
          city: input.deliveryCity,
          department: input.deliveryDepartment,
          status: 'PENDING',
        });
        await queryRunner1.manager.save(DeliveryOrmEntity, deliveryRecord);

        await queryRunner1.manager.decrement(
          StockOrmEntity,
          { productId: input.productId },
          'quantity',
          1,
        );

        await queryRunner1.commitTransaction();

        this.audit.log({
          event: 'TRANSACTION_CREATED',
          transactionId: pendingTransaction.id,
          reference,
          productId: product.id,
          amountInCents,
        });
      } catch (error) {
        try {
          await queryRunner1.rollbackTransaction();
        } catch (rollbackError) {
          this.audit.error({
            event: 'TRANSACTION_DECLINED',
            error:
              rollbackError instanceof Error
                ? rollbackError.message
                : 'Unknown',
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown';
        this.audit.error({
          event: 'TRANSACTION_ERROR',
          error: errorMessage,
        });
        return err(
          new InternalServerError(`Failed to start transaction: ${errorMessage}`),
        );
      }

      const gatewayResult = await this.gateway.createTransaction({
        cardToken: input.cardToken,
        amountInCents,
        currency: 'COP',
        customerEmail: customer.email,
        customerName: customer.name,
        customerPhone: customer.phone,
        reference,
      });

      if (!gatewayResult.success) {
        await this.finalizeTransaction.execute({
          reference,
          status: 'ERROR',
        });
        return err(gatewayResult.error);
      }

      const paymentData = gatewayResult.value;
      await this.finalizeTransaction.execute({
        reference,
        status: paymentData.status,
        gatewayId: paymentData.id,
      });

      return ok({
        transactionId: pendingTransaction.id,
        reference,
        status: paymentData.status,
        gatewayId: paymentData.id,
        amountInCents,
      });
    } catch (error) {
      this.audit.error({
        event: 'TRANSACTION_ERROR',
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return err(new InternalServerError('Payment processing failed'));
    } finally {
      try {
        await queryRunner1.release();
      } catch (releaseError) {
        this.audit.error({
          event: 'TRANSACTION_ERROR',
          error:
            releaseError instanceof Error ? releaseError.message : 'Unknown',
        });
      }
    }
  }
}
