import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './modules/customers/customers.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { ProductsModule } from './modules/products/products.module';
import { StockModule } from './modules/stock/stock.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AuditModule } from './shared/audit.module';
import { throttlerConfig } from './shared/config/throttler.config';
import { winstonConfig } from './shared/config/winston.config';
import { getTypeOrmConfig } from './shared/database/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),
    WinstonModule.forRoot(winstonConfig),
    AuditModule,
    ThrottlerModule.forRoot(throttlerConfig),

    ProductsModule, StockModule, CustomersModule, DeliveriesModule, TransactionsModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'APP_GUARD',
      useClass: require('@nestjs/throttler').ThrottlerGuard,
    },
  ],
})
export class AppModule { }
