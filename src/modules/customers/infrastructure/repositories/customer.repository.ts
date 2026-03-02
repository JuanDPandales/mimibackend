export class Customer {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly createdAt: Date,
  ) {}
}

export interface UpsertCustomerInput {
  name: string;
  email: string;
  phone: string;
}

export interface ICustomerRepository {
  upsertByEmail(input: UpsertCustomerInput): Promise<Customer>;
  findById(id: string): Promise<Customer | null>;
}

export const CUSTOMER_REPOSITORY = Symbol('ICustomerRepository');
