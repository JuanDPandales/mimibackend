import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CustomerOrmEntity } from '../../modules/customers/infrastructure/entities/customer.orm-entity';
import { DeliveryOrmEntity } from '../../modules/deliveries/infrastructure/entities/delivery.orm-entity';
import { ProductOrmEntity } from '../../modules/products/infrastructure/entities/product.orm-entity';
import { StockOrmEntity } from '../../modules/stock/infrastructure/entities/stock.orm-entity';
import { TransactionOrmEntity } from '../../modules/transactions/infrastructure/entities/transaction.orm-entity';
import { IdempotencyKeyOrmEntity } from '../../modules/transactions/infrastructure/entities/idempotency-key.orm-entity';
import { ConfigService } from '@nestjs/config';

export const getTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: configService.get<string>('DATABASE_URL'),
  ssl: configService.get<string>('NODE_ENV') === 'production'
    ? { rejectUnauthorized: true }
    : {
      rejectUnauthorized: false,
    },
  entities: [
    CustomerOrmEntity,
    DeliveryOrmEntity,
    ProductOrmEntity,
    StockOrmEntity,
    TransactionOrmEntity,
    IdempotencyKeyOrmEntity,
  ],
  synchronize: false,
});
