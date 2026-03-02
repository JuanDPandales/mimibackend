import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryOrmEntity } from '../entities/delivery.orm-entity';
import {
    CreateDeliveryInput,
    Delivery,
    IDeliveryRepository,
} from './delivery.repository';

@Injectable()
export class DeliveryTypeOrmRepository implements IDeliveryRepository {
    constructor(
        @InjectRepository(DeliveryOrmEntity)
        private readonly repository: Repository<DeliveryOrmEntity>,
    ) { }

    async create(input: CreateDeliveryInput): Promise<Delivery> {
        const entity = this.repository.create({
            transactionId: input.transactionId,
            customerId: input.customerId,
            address: input.address,
            city: input.city,
            department: input.department,
            status: input.status,
        });
        const saved = await this.repository.save(entity);
        return new Delivery(
            saved.id,
            saved.transactionId,
            saved.customerId,
            saved.address,
            saved.city,
            saved.department,
            saved.status,
            saved.createdAt,
        );
    }

    async findByTransactionId(transactionId: string): Promise<Delivery | null> {
        const entity = await this.repository.findOne({ where: { transactionId } });
        if (!entity) return null;
        return new Delivery(
            entity.id,
            entity.transactionId,
            entity.customerId,
            entity.address,
            entity.city,
            entity.department,
            entity.status,
            entity.createdAt,
        );
    }
}
