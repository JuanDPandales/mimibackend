import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../shared/audit/audit.module';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';
import { PaymentGatewayService } from '../../shared/payment-gateway/payment-gateway.service';
import { CustomersModule } from '../customers/customers.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { ProductsModule } from '../products/products.module';
import { StockModule } from '../stock/stock.module';
import { FinalizeTransactionService } from './application/use-cases/finalize-transaction.service';
import { GetTransactionUseCase } from './application/use-cases/get-transaction.service';
import { ProcessPaymentService } from './application/use-cases/process-payment.service';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { IdempotencyKeyOrmEntity } from './infrastructure/entities/idempotency-key.orm-entity';
import { TransactionOrmEntity } from './infrastructure/entities/transaction.orm-entity';
import { TransactionRepository } from './infrastructure/repositories/transaction.repository';
import { TransactionsController } from './presentation/transactions.controller';
import { WebhooksController } from './presentation/webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionOrmEntity, IdempotencyKeyOrmEntity]),
    ProductsModule,
    StockModule,
    CustomersModule,
    DeliveriesModule,
    AuditModule,
  ],
  controllers: [TransactionsController, WebhooksController],
  providers: [
    ProcessPaymentService,
    FinalizeTransactionService,
    GetTransactionUseCase,
    PaymentGatewayService,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class TransactionsModule { }
