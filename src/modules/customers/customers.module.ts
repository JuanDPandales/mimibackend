import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerOrmEntity } from './infrastructure/entities/customer.orm-entity';
import { CustomerTypeOrmRepository } from './infrastructure/repositories/customer-typeorm.repository';
import { CUSTOMER_REPOSITORY } from './infrastructure/repositories/customer.repository';

@Module({
    imports: [TypeOrmModule.forFeature([CustomerOrmEntity])],
    providers: [
        {
            provide: CUSTOMER_REPOSITORY,
            useClass: CustomerTypeOrmRepository,
        },
    ],
    exports: [CUSTOMER_REPOSITORY],
})
export class CustomersModule { }
