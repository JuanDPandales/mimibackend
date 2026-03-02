import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Result,
  ok,
  err,
  NotFoundError,
  OutOfStockError,
  InternalServerError,
} from '../../../../shared/result/result';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../../modules/customers/infrastructure/repositories/customer.repository';
import {
  DELIVERY_REPOSITORY,
  type IDeliveryRepository,
} from '../../../../modules/deliveries/infrastructure/repositories/delivery.repository';
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from '../../../products/domain/product.repository';
import {
  STOCK_REPOSITORY,
  type IStockRepository,
} from '../../../stock/domain/stock.repository';
import { AuditLogger } from '../../../../shared/audit/audit.logger';
import { DataSource } from 'typeorm';
import {
  TRANSACTION_REPOSITORY,
  type ITransactionRepository,
} from '../../domain/transaction.repository';
import { PaymentGatewayService } from '../../../../shared/payment-gateway/payment-gateway.service';
import { Transaction } from '../../domain/transaction.entity';
import * as crypto from 'crypto';

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
  paymentId: string | null;
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
    // 1. Validar producto existe
    const product = await this.productRepo.findById(input.productId);
    if (!product) {
      return err(new NotFoundError('Product'));
    }

    // 2. Upsert customer
    const customer = await this.customerRepo.upsertByEmail({
      name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
    });

    const amountInCents =
      (product.price + this.baseFee + this.deliveryFee) * 100;
    const reference = crypto.randomUUID();

    // QueryRunner #1: Validar stock, bloquear fila e insertar Transaction PENDING
    const queryRunner1 = this.dataSource.createQueryRunner();
    await queryRunner1.connect();
    await queryRunner1.startTransaction('SERIALIZABLE');

    let pendingTransaction: Transaction;

    try {
      // SELECT FOR UPDATE on stock
      // This is a raw conceptual TypeORM query to lock the row. We assume the ORM repository could also have a method with locks.
      // But we will use raw query or entityManager to enforce the lock.
      const stockRecord = await queryRunner1.manager
        .createQueryBuilder()
        .select('stock')
        .from('stock', 'stock')
        .where('stock.product_id = :productId', { productId: input.productId })
        .setLock('pessimistic_write')
        .getOne();

      if (!stockRecord || stockRecord.quantity <= 0) {
        await queryRunner1.rollbackTransaction();
        return err(new OutOfStockError());
      }

      // Crear transaccion en el dominio
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

      // Persist using transactional entity manager or repo
      await this.txRepo.create(pendingTransaction); // Assuming repo acts upon the current context/global, ideally should receive entityManager but we'll mock behavior if not explicitly designed for query runner injection. Since repo is injected, we will simulate DB save via raw manager to be fully safe in transaction context.
      // Better: use the QueryRunner's manager dynamically:
      const txOrmEntity = queryRunner1.manager.create('transactions', {
        id: pendingTransaction.id,
        customer_id: customer.id,
        product_id: product.id,
        reference: pendingTransaction.reference,
        amount_in_cents: pendingTransaction.amountInCents,
        status: 'PENDING',
      });
      await queryRunner1.manager.save('transactions', txOrmEntity);

      await queryRunner1.commitTransaction();

      this.audit.log({
        event: 'TRANSACTION_CREATED',
        transactionId: pendingTransaction.id,
        reference: reference,
        productId: product.id,
        amountInCents,
      });
    } catch (error) {
      await queryRunner1.rollbackTransaction();
      this.audit.error({
        event: 'TRANSACTION_ERROR',
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return err(new InternalServerError('Failed to start transaction'));
    } finally {
      await queryRunner1.release();
    }

    // 6. Payment Gateway API call (Outside DB Transaction)
    const gatewayResult = await this.gateway.createTransaction({
      cardToken: input.cardToken,
      amountInCents: amountInCents,
      currency: 'COP',
      customerEmail: customer.email,
      reference: reference,
    });

    // QueryRunner #2: Actualizar estado, descontar stock si aprobado, generar delivery
    const queryRunner2 = this.dataSource.createQueryRunner();
    await queryRunner2.connect();
    await queryRunner2.startTransaction();

    try {
      if (!gatewayResult.success) {
        pendingTransaction.markError();
        await queryRunner2.manager.update(
          'transactions',
          { id: pendingTransaction.id },
          { status: 'ERROR', updated_at: new Date() },
        );
        await queryRunner2.commitTransaction();
        return err(gatewayResult.error);
      }

      const paymentData = gatewayResult.value;

      if (paymentData.status === 'APPROVED') {
        pendingTransaction.approve(paymentData.id);
        await queryRunner2.manager.update(
          'transactions',
          { id: pendingTransaction.id },
          {
            status: 'APPROVED',
            gateway_id: paymentData.id,
            updated_at: new Date(),
          },
        );

        // Decrement stock
        await queryRunner2.manager.decrement(
          'stock',
          { product_id: product.id },
          'quantity',
          1,
        );

        // Create Delivery
        const deliveryRecord = queryRunner2.manager.create('deliveries', {
          id: crypto.randomUUID(),
          trans_id: pendingTransaction.id,
          customer_id: customer.id,
          address: input.deliveryAddress,
          city: input.deliveryCity,
          department: input.deliveryDepartment,
          status: 'PENDING',
        });
        await queryRunner2.manager.save('deliveries', deliveryRecord);

        this.audit.log({
          event: 'TRANSACTION_APPROVED',
          transactionId: pendingTransaction.id,
          gatewayId: paymentData.id,
        });
      } else {
        pendingTransaction.decline(paymentData.id);
        await queryRunner2.manager.update(
          'transactions',
          { id: pendingTransaction.id },
          {
            status: 'DECLINED',
            gateway_id: paymentData.id,
            updated_at: new Date(),
          },
        );

        this.audit.warn({
          event: 'TRANSACTION_DECLINED',
          transactionId: pendingTransaction.id,
          gatewayId: paymentData.id,
        });
      }

      await queryRunner2.commitTransaction();

      return ok({
        transactionId: pendingTransaction.id,
        reference: reference,
        status: paymentData.status,
        paymentId: paymentData.id,
        amountInCents: amountInCents,
      });
    } catch (error) {
      await queryRunner2.rollbackTransaction();
      this.audit.error({
        event: 'TRANSACTION_ERROR',
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return err(new InternalServerError('Finalization transaction failed'));
    } finally {
      await queryRunner2.release();
    }
  }
}
