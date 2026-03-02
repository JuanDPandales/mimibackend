import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionUseCase } from './get-transaction.service';
import {
  TRANSACTION_REPOSITORY,
  type ITransactionRepository,
} from '../../domain/transaction.repository';
import { Transaction } from '../../domain/transaction.entity';

describe('GetTransactionUseCase', () => {
  let service: GetTransactionUseCase;
  let mockTxRepo: { findByReference: jest.Mock };

  beforeEach(async () => {
    mockTxRepo = {
      findByReference: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTransactionUseCase,
        {
          provide: TRANSACTION_REPOSITORY,
          useValue: mockTxRepo as unknown as ITransactionRepository,
        },
      ],
    }).compile();

    service = module.get<GetTransactionUseCase>(GetTransactionUseCase);
  });

  it('should return ok result when transaction is found', async () => {
    const mockTx = new Transaction(
      'tx-1',
      'cust-1',
      'prod-1',
      'ref-001',
      1000,
      'APPROVED',
      'gw-1',
      new Date(),
      new Date(),
    );
    mockTxRepo.findByReference.mockResolvedValue(mockTx);

    const result = await service.execute('ref-001');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(mockTx);
    }
    expect(mockTxRepo.findByReference).toHaveBeenCalledWith('ref-001');
  });

  it('should return NotFoundError when transaction is not found', async () => {
    mockTxRepo.findByReference.mockResolvedValue(null);

    const result = await service.execute('missing-ref');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('NotFoundError');
    }
    expect(mockTxRepo.findByReference).toHaveBeenCalledWith('missing-ref');
  });
});

