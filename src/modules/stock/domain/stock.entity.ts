export class Stock {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly updatedAt: Date,
  ) {}

  isAvailable(): boolean {
    return this.quantity > 0;
  }

  decrement(): Stock {
    if (!this.isAvailable()) {
      throw new Error('Stock is not available');
    }

    return new Stock(this.id, this.productId, this.quantity - 1, new Date());
  }
}
