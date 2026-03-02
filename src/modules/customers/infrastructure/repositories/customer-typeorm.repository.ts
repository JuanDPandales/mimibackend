import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../domain/customer.entity';
import { CustomerOrmEntity } from '../entities/customer.orm-entity';
import {
    ICustomerRepository,
    UpsertCustomerInput,
} from './customer.repository';

@Injectable()
export class CustomerTypeOrmRepository implements ICustomerRepository {
    constructor(
        @InjectRepository(CustomerOrmEntity)
        private readonly repository: Repository<CustomerOrmEntity>,
    ) { }

    async upsertByEmail(input: UpsertCustomerInput): Promise<Customer> {
        let entity = await this.repository.findOne({
            where: { email: input.email },
        });
        if (entity) {
            entity.name = input.name;
            entity.phone = input.phone;
        } else {
            entity = this.repository.create({
                name: input.name,
                email: input.email,
                phone: input.phone,
            });
        }
        const saved = await this.repository.save(entity);
        return new Customer(
            saved.id,
            saved.name,
            saved.email,
            saved.phone,
            saved.createdAt,
            saved.createdAt,
        );
    }

    async findById(id: string): Promise<Customer | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;
        return new Customer(
            entity.id,
            entity.name,
            entity.email,
            entity.phone,
            entity.createdAt,
            entity.createdAt,
        );
    }
}
