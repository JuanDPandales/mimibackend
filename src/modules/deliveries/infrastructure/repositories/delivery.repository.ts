export class Delivery {
  constructor(
    public readonly id: string,
    public readonly transactionId: string,
    public readonly customerId: string,
    public readonly address: string,
    public readonly city: string,
    public readonly department: string,
    public status: string,
    public readonly createdAt: Date,
  ) {}
}

export interface CreateDeliveryInput {
  transactionId: string;
  customerId: string;
  address: string;
  city: string;
  department: string;
  status: string;
}

export interface IDeliveryRepository {
  create(input: CreateDeliveryInput): Promise<Delivery>;
  findByTransactionId(transactionId: string): Promise<Delivery | null>;
}

export const DELIVERY_REPOSITORY = Symbol('IDeliveryRepository');
