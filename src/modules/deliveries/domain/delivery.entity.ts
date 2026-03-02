export class Delivery {
  constructor(
    public readonly id: string,
    public readonly transactionId: string,
    public readonly customerId: string,
    public readonly address: string,
    public readonly city: string,
    public readonly department: string,
    public status: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}
