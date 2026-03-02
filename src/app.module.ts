import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './modules/customers/customers.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { ProductsModule } from './modules/products/products.module';
import { StockModule } from './modules/stock/stock.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AuditModule } from './shared/audit/audit.module';
import { throttlerConfig } from './shared/config/throttler.config';
import { winstonConfig } from './shared/config/winston.config';
import { getTypeOrmConfig } from './shared/database/typeorm.config';
import { paymentConfig } from './shared/config/payment.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [paymentConfig],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),
    WinstonModule.forRoot(winstonConfig),
    AuditModule,
    ThrottlerModule.forRoot(throttlerConfig),

    ProductsModule,
    StockModule,
    CustomersModule,
    DeliveriesModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'APP_GUARD',
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
