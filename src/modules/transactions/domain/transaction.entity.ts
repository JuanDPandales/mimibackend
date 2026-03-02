export class Transaction {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly productId: string,
    public readonly reference: string,
    public readonly amountInCents: number,
    public status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR',
    public gatewayId: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  approve(gatewayId: string): void {
    this.status = 'APPROVED';
    this.gatewayId = gatewayId;
    this.updatedAt = new Date();
  }

  decline(gatewayId?: string): void {
    this.status = 'DECLINED';
    if (gatewayId) {
      this.gatewayId = gatewayId;
    }
    this.updatedAt = new Date();
  }

  markError(): void {
    this.status = 'ERROR';
    this.updatedAt = new Date();
  }
}
