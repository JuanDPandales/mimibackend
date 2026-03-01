import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './modules/products/products.module';
import { StockModule } from './modules/stock/stock.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AuditModule } from './shared/audit.module';

@Module({
  imports: [ProductsModule, StockModule, CustomersModule, DeliveriesModule, TransactionsModule, AuditModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
