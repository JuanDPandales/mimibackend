import { Transaction } from './transaction.entity';

export const TRANSACTION_REPOSITORY = 'TRANSACTION_REPOSITORY';

export interface ITransactionRepository {
  create(transaction: Transaction): Promise<Transaction>;
  findByReference(reference: string): Promise<Transaction | null>;
  updateStatus(
    reference: string,
    status: string,
    gatewayId?: string,
  ): Promise<void>;
}
