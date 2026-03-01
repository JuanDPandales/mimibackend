import { Module } from '@nestjs/common';
import { TransactionsController } from './presentation/transactions.controller';
import { WebhooksController } from './presentation/webhooks.controller';
import { ProcessPaymentService } from './application/use-cases/process-payment.service';
import { GetTransactionService } from './application/use-cases/get-transaction.service';

@Module({
  controllers: [TransactionsController, WebhooksController],
  providers: [ProcessPaymentService, GetTransactionService]
})
export class TransactionsModule {}
