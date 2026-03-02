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
): TypeOrmModuleOptions => {
  const url = configService.get<string>('DATABASE_URL');
  const env = configService.get<string>('NODE_ENV');

  // Diagnóstico para Railway/Producción
  console.log(`[DB-Debug] Attempting connection. Env: ${env}`);
  if (url) {
    const host = url.split('@')[1]?.split(':')[0];
    console.log(`[DB-Debug] Target host: ${host}`);
  } else {
    console.warn('[DB-Debug] DATABASE_URL is not defined!');
  }

  return {
    type: 'postgres',
    url,
    ssl: configService.get<string>('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
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
    logging: true,
  };
};
