import { Inject, Injectable } from '@nestjs/common';
import {
  Result,
  ok,
  err,
  NotFoundError,
} from '../../../../shared/result/result';
import { Transaction } from '../../domain/transaction.entity';
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../domain/transaction.repository';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepo: ITransactionRepository,
  ) {}

  async execute(reference: string): Promise<Result<Transaction>> {
    const transaction = await this.transactionRepo.findByReference(reference);
    if (!transaction) {
      return err(
        new NotFoundError(`Transaction with reference ${reference} not found`),
      );
    }
    return ok(transaction);
  }
}
