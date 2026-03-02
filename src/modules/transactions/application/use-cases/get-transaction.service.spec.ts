import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionUseCase } from './get-transaction.service';
import { TRANSACTION_REPOSITORY } from '../../domain/transaction.repository';
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
        { provide: TRANSACTION_REPOSITORY, useValue: mockTxRepo },
      ],
    }).compile();

    service = module.get<GetTransactionUseCase>(GetTransactionUseCase);
  });

  it('should return successfully with the transaction if found', async () => {
    const now = new Date();
    const expectedTx = new Transaction(
      'id1',
      'c1',
      'p1',
      'ref-123',
      1000,
      'APPROVED',
      'gw-1',
      now,
      now,
    );
    mockTxRepo.findByReference.mockResolvedValue(expectedTx);

    const result = await service.execute('ref-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(expectedTx); // same instance returned by ok()
      expect(result.value.id).toBe('id1');
      expect(result.value.reference).toBe('ref-123');
      expect(result.value.status).toBe('APPROVED');
    }
  });

  it('should return NotFoundError if transaction is not found', async () => {
    mockTxRepo.findByReference.mockResolvedValue(null);

    const result = await service.execute('ref-unknown');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('NotFoundError');
      expect(result.error.message).toContain('ref-unknown');
    }
  });
});
