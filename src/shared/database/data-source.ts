import 'dotenv/config';
import { DataSource } from 'typeorm';
import { CustomerOrmEntity } from '../../modules/customers/infrastructure/entities/customer.orm-entity';
import { DeliveryOrmEntity } from '../../modules/deliveries/infrastructure/entities/delivery.orm-entity';
import { ProductOrmEntity } from '../../modules/products/infrastructure/entities/product.orm-entity';
import { StockOrmEntity } from '../../modules/stock/infrastructure/entities/stock.orm-entity';
import { TransactionOrmEntity } from '../../modules/transactions/infrastructure/entities/transaction.orm-entity';
import { IdempotencyKeyOrmEntity } from '../../modules/transactions/infrastructure/entities/idempotency-key.orm-entity';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
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
    migrations: ['src/shared/database/migrations/*.ts'],
    synchronize: false,
});
