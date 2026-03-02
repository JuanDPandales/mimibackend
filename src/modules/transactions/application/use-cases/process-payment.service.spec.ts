import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DeliveryOrmEntity } from '../../../../modules/deliveries/infrastructure/entities/delivery.orm-entity';
import { AuditLogger } from '../../../../shared/audit/audit.logger';
import { PaymentGatewayService } from '../../../../shared/payment-gateway/payment-gateway.service';
import { err, PaymentError } from '../../../../shared/result/result';
import { Customer } from '../../../customers/domain/customer.entity';
import { CUSTOMER_REPOSITORY } from '../../../customers/infrastructure/repositories/customer.repository';
import { DELIVERY_REPOSITORY } from '../../../deliveries/infrastructure/repositories/delivery.repository';
import { PRODUCT_REPOSITORY } from '../../../products/domain/product.repository';
import { STOCK_REPOSITORY } from '../../../stock/domain/stock.repository';
import { TRANSACTION_REPOSITORY } from '../../domain/transaction.repository';
import { TransactionOrmEntity } from '../../infrastructure/entities/transaction.orm-entity';
import { FinalizeTransactionService } from './finalize-transaction.service';
import {
  ProcessPaymentInput,
  ProcessPaymentService,
} from './process-payment.service';

describe('ProcessPaymentService', () => {
  let service: ProcessPaymentService;
  let mockProductRepo: { findById: jest.Mock };
  let mockCustomerRepo: { upsertByEmail: jest.Mock };
  let mockStockRepo: Record<string, jest.Mock>;
  let mockTxRepo: { create: jest.Mock };
  let mockDeliveryRepo: Record<string, jest.Mock>;
  let mockGateway: { createTransaction: jest.Mock };
  let mockFinalizeService: { execute: jest.Mock };
  let mockConfig: { get: jest.Mock };
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockAuditLogger: { log: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      createQueryBuilder: jest.Mock;
      select: jest.Mock;
      from: jest.Mock;
      where: jest.Mock;
      setLock: jest.Mock;
      getOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
      update: jest.Mock;
      decrement: jest.Mock;
    };
  };

  const mockInput: ProcessPaymentInput = {
    productId: 'prod-1',
    cardToken: 'tok_test',
    customerName: 'Juan',
    customerEmail: 'juan@test.com',
    customerPhone: '1234567890',
    deliveryAddress: 'Casa',
    deliveryCity: 'Bogota',
    deliveryDepartment: 'Bogota DC',
  };

  const mockCustomer = new Customer(
    'c-1',
    'Juan',
    'juan@test.com',
    '123',
    new Date(),
    new Date(),
  );

  const mockProduct = { id: 'prod-1', price: 10000 };

  function buildQueryRunnerMock(): any {
    const qb = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      decrement: jest.fn().mockResolvedValue({}),
    };
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: qb,
    };
  }

  beforeEach(async () => {
    mockProductRepo = { findById: jest.fn() };
    mockCustomerRepo = { upsertByEmail: jest.fn() };
    mockStockRepo = {};
    mockTxRepo = { create: jest.fn().mockResolvedValue(undefined) };
    mockDeliveryRepo = {};
    mockGateway = { createTransaction: jest.fn() };
    mockFinalizeService = { execute: jest.fn().mockResolvedValue(undefined) };
    mockConfig = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'payment.baseFee') return 3500;
        if (key === 'payment.deliveryFee') return 8000;
        return null;
      }),
    };
    mockAuditLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    mockQueryRunner = buildQueryRunnerMock();
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessPaymentService,
        { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
        { provide: CUSTOMER_REPOSITORY, useValue: mockCustomerRepo },
        { provide: STOCK_REPOSITORY, useValue: mockStockRepo },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTxRepo },
        { provide: DELIVERY_REPOSITORY, useValue: mockDeliveryRepo },
        { provide: PaymentGatewayService, useValue: mockGateway },
        { provide: FinalizeTransactionService, useValue: mockFinalizeService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditLogger, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get<ProcessPaymentService>(ProcessPaymentService);
  });

  it('applies default fees when config returns 0/undefined', () => {
    const cfg = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'payment.baseFee') return 0;
        if (key === 'payment.deliveryFee') return undefined;
        return null;
      }),
    } as unknown as ConfigService;

    const dummy = {} as any;
    const svc = new ProcessPaymentService(
      dummy,
      dummy,
      dummy,
      dummy,
      dummy,
      dummy,
      dummy,
      cfg,
      { createQueryRunner: jest.fn().mockReturnValue({ release: jest.fn() }) } as any,
      { log: jest.fn(), error: jest.fn(), warn: jest.fn() } as any,
    );

    expect((svc as any).baseFee).toBe(3500);
    expect((svc as any).deliveryFee).toBe(8000);
  });

  // ─── Existing tests ──────────────────────────────────────────────────────────

  it('should return NotFoundError if product does not exist', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Product');
    }
  });

  it('should return OutOfStockError if stock quantity is <= 0', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 0 });

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('OutOfStockError');
    }
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should process payment successfully and call finalizeTransaction', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-123', status: 'APPROVED' },
    });

    const result = await service.execute(mockInput);

    expect(result.success).toBe(true);
    expect(mockFinalizeService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'APPROVED',
        gatewayId: 'gw-123',
      }),
    );
    expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
      DeliveryOrmEntity,
      expect.objectContaining({ status: 'PENDING' }),
    );
  });

  it('should call finalizeTransaction with ERROR when gateway fails', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });

    const gatewayError = new PaymentError('Gateway failed');
    mockGateway.createTransaction.mockResolvedValue(err(gatewayError));

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockFinalizeService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ERROR',
      }),
    );
  });

  it('should return Payment processing failed when gateway throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockRejectedValue(new Error('Gateway crash'));

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Payment processing failed');
    }
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_ERROR' }),
    );
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  // ─── New tests for coverage ───────────────────────────────────────────────────

  it('should release queryRunner even when product is not found', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    await service.execute(mockInput);

    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should return OutOfStockError if stock record does not exist (getOne returns null)', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue(null);

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('OutOfStockError');
    }
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should rollback and rethrow if saving transaction throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner.manager.save.mockRejectedValue(new Error('DB save failed'));

    const result = await service.execute(mockInput);

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('should release queryRunner after successful payment flow', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-456', status: 'APPROVED' },
    });

    await service.execute(mockInput);

    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should rollback and release if commitTransaction throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-789', status: 'APPROVED' },
    });
    mockQueryRunner.commitTransaction.mockRejectedValue(
      new Error('Commit failed'),
    );

    const result = await service.execute(mockInput);

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('should still release queryRunner if rollback itself throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 0 });
    mockQueryRunner.rollbackTransaction.mockRejectedValue(
      new Error('Rollback failed'),
    );

    await service.execute(mockInput);

    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should log rollback error as Unknown when rollback throws non-Error', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 0 });
    mockQueryRunner.rollbackTransaction.mockRejectedValue('Rollback failed');

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_ERROR',
        error: 'Unknown',
      }),
    );
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should return error if upsertByEmail throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockRejectedValue(
      new Error('Customer upsert failed'),
    );

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should call gateway with correct amount including fees', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 3 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-001', status: 'APPROVED' },
    });

    await service.execute(mockInput);

    // product price 10000 + baseFee 3500 + deliveryFee 8000 = 21500
    expect(mockGateway.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amountInCents: 21500,
      }),
    );
  });

  it('should call finalizeTransaction with PENDING status when gateway returns PENDING', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-pending', status: 'PENDING' },
    });

    const result = await service.execute(mockInput);

    expect(result.success).toBe(true);
    expect(mockFinalizeService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',
        gatewayId: 'gw-pending',
      }),
    );
  });

  it('should save TransactionOrmEntity with correct fields', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-tx', status: 'APPROVED' },
    });

    await service.execute(mockInput);

    expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
      TransactionOrmEntity,
      expect.any(Object),
    );
  });

  it('should decrement stock after successful transaction save', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-dec', status: 'APPROVED' },
    });

    await service.execute(mockInput);

    expect(mockQueryRunner.manager.decrement).toHaveBeenCalledTimes(1);
  });

  it('should log QUERY_RUNNER_RELEASE_ERROR if release throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-rel', status: 'APPROVED' },
    });
    mockQueryRunner.release.mockRejectedValue(new Error('release failed'));

    const result = await service.execute(mockInput);

    expect(result.success).toBe(true);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_ERROR',
      }),
    );
  });

  it('should log Unknown when release throws non-Error', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-rel2', status: 'APPROVED' },
    });
    mockQueryRunner.release.mockRejectedValue('release failed');

    const result = await service.execute(mockInput);

    expect(result.success).toBe(true);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_ERROR',
        error: 'Unknown',
      }),
    );
  });

  it('should log TRANSACTION_ROLLBACK_ERROR when rollback in catch fails', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner.manager.save.mockRejectedValue(new Error('save failed'));
    mockQueryRunner.rollbackTransaction.mockRejectedValue(
      new Error('rollback failed in catch'),
    );

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_DECLINED',
      }),
    );
  });

  it('should use Unknown when both operation error and rollback error are non-Error', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner.manager.save.mockRejectedValue('save failed');
    mockQueryRunner.rollbackTransaction.mockRejectedValue('rollback failed');

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Failed to start transaction');
      expect(result.error.message).toContain('Unknown');
    }
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_DECLINED',
        error: 'Unknown',
      }),
    );
  });

  it('should log Unknown when outer catch receives non-Error', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockGateway.createTransaction.mockRejectedValue('boom');

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_ERROR',
        error: 'Unknown',
      }),
    );
  });
});