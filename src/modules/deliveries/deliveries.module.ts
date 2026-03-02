import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryOrmEntity } from './infrastructure/entities/delivery.orm-entity';
import { DeliveryTypeOrmRepository } from './infrastructure/repositories/delivery-typeorm.repository';
import { DELIVERY_REPOSITORY } from './infrastructure/repositories/delivery.repository';

@Module({
    imports: [TypeOrmModule.forFeature([DeliveryOrmEntity])],
    providers: [
        {
            provide: DELIVERY_REPOSITORY,
            useClass: DeliveryTypeOrmRepository,
        },
    ],
    exports: [DELIVERY_REPOSITORY],
})
export class DeliveriesModule { }
