export class Customer {
  constructor(
    public readonly id: string,
    public name: string,
    public readonly email: string,
    public phone: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}
