import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DeliveryOrmEntity } from '../../../../modules/deliveries/infrastructure/entities/delivery.orm-entity';
import { StockOrmEntity } from '../../../../modules/stock/infrastructure/entities/stock.orm-entity';
import { AuditLogger } from '../../../../shared/audit/audit.logger';
import { TransactionOrmEntity } from '../../infrastructure/entities/transaction.orm-entity';
import {
  FinalizeTransactionInput,
  FinalizeTransactionService,
} from './finalize-transaction.service';

describe('FinalizeTransactionService', () => {
  let service: FinalizeTransactionService;
  let mockAuditLogger: { log: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      findOne: jest.Mock;
      save: jest.Mock;
      update: jest.Mock;
      decrement: jest.Mock;
    };
  };

  const mockTransaction = {
    id: 'tx-1',
    reference: 'ref-001',
    status: 'PENDING',
    gatewayId: null,
    productId: 'prod-1',
    updatedAt: new Date(),
  };

  function buildQueryRunnerMock() {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        decrement: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  beforeEach(async () => {
    mockQueryRunner = buildQueryRunnerMock();
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    mockAuditLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinalizeTransactionService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditLogger, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get<FinalizeTransactionService>(FinalizeTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Transaction not found ────────────────────────────────────────────────────

  it('should rollback and warn if transaction is not found', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue(null);

    await service.execute({ reference: 'ref-not-found', status: 'APPROVED' });

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    expect(mockAuditLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_ERROR' }),
    );
    expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
  });

  // ─── Already finalized (skip) ─────────────────────────────────────────────────

  it.each(['APPROVED', 'DECLINED', 'ERROR'])(
    'should rollback and return early if transaction is already %s',
    async (finalStatus) => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockTransaction,
        status: finalStatus,
      });

      await service.execute({ reference: 'ref-001', status: 'APPROVED' });

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    },
  );

  // ─── APPROVED flow ────────────────────────────────────────────────────────────

  it('should update transaction, decrement stock and set delivery to PENDING on APPROVED', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });

    const input: FinalizeTransactionInput = {
      reference: 'ref-001',
      status: 'APPROVED',
      gatewayId: 'gw-123',
    };

    await service.execute(input);

    expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
      TransactionOrmEntity,
      expect.objectContaining({ status: 'APPROVED', gatewayId: 'gw-123' }),
    );
    expect(mockQueryRunner.manager.decrement).toHaveBeenCalledWith(
      StockOrmEntity,
      { productId: 'prod-1' },
      'quantity',
      1,
    );
    expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
      DeliveryOrmEntity,
      { transactionId: 'tx-1' },
      { status: 'PENDING' },
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    expect(mockAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_APPROVED' }),
    );
  });

  it('should preserve existing gatewayId if not provided in input', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({
      ...mockTransaction,
      gatewayId: 'existing-gw',
    });

    await service.execute({ reference: 'ref-001', status: 'APPROVED' });

    expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
      TransactionOrmEntity,
      expect.objectContaining({ gatewayId: 'existing-gw' }),
    );
  });

  // ─── DECLINED flow ────────────────────────────────────────────────────────────

  it('should update delivery to CANCELLED and warn on DECLINED', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });

    await service.execute({ reference: 'ref-001', status: 'DECLINED' });

    expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
      DeliveryOrmEntity,
      { transactionId: 'tx-1' },
      { status: 'CANCELLED' },
    );
    expect(mockQueryRunner.manager.decrement).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockAuditLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_DECLINED' }),
    );
  });

  // ─── ERROR flow ───────────────────────────────────────────────────────────────

  it('should update delivery to CANCELLED and warn on ERROR status', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });

    await service.execute({ reference: 'ref-001', status: 'ERROR' });

    expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
      DeliveryOrmEntity,
      { transactionId: 'tx-1' },
      { status: 'CANCELLED' },
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockAuditLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_DECLINED' }),
    );
  });

  // ─── Unknown status (no side effects) ────────────────────────────────────────

  it('should save transaction without stock/delivery side effects for unknown status', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });

    await service.execute({ reference: 'ref-001', status: 'VOIDED' });

    expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.manager.decrement).not.toHaveBeenCalled();
    expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  // ─── Catch / rollback paths ───────────────────────────────────────────────────

  it('should rollback, log error and rethrow if save throws', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });
    mockQueryRunner.manager.save.mockRejectedValue(new Error('DB save failed'));

    await expect(
      service.execute({ reference: 'ref-001', status: 'APPROVED' }),
    ).rejects.toThrow('DB save failed');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_ERROR',
        error: 'DB save failed',
      }),
    );
  });

  it('should rollback, log error and rethrow if decrement throws', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });
    mockQueryRunner.manager.decrement.mockRejectedValue(
      new Error('Decrement failed'),
    );

    await expect(
      service.execute({ reference: 'ref-001', status: 'APPROVED' }),
    ).rejects.toThrow('Decrement failed');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should log "Unknown error during finalization" when a non-Error is thrown', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });
    mockQueryRunner.manager.save.mockRejectedValue('plain string error');

    await expect(
      service.execute({ reference: 'ref-001', status: 'APPROVED' }),
    ).rejects.toBe('plain string error');

    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unknown error during finalization',
      }),
    );
  });

  it('should always release queryRunner even if rollback throws', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValue({ ...mockTransaction });
    mockQueryRunner.manager.save.mockRejectedValue(new Error('save failed'));
    mockQueryRunner.rollbackTransaction.mockRejectedValue(
      new Error('rollback failed'),
    );

    await expect(
      service.execute({ reference: 'ref-001', status: 'APPROVED' }),
    ).rejects.toThrow();

    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });
});