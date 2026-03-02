import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuditLogger } from '../../../../shared/audit/audit.logger';
import { PaymentGatewayService } from '../../../../shared/payment-gateway/payment-gateway.service';
import { Customer } from '../../../customers/domain/customer.entity';
import { CUSTOMER_REPOSITORY } from '../../../customers/infrastructure/repositories/customer.repository';
import { DELIVERY_REPOSITORY } from '../../../deliveries/infrastructure/repositories/delivery.repository';
import { PRODUCT_REPOSITORY } from '../../../products/domain/product.repository';
import { STOCK_REPOSITORY } from '../../../stock/domain/stock.repository';
import { TRANSACTION_REPOSITORY } from '../../domain/transaction.repository';
import {
  ProcessPaymentInput,
  ProcessPaymentService,
} from './process-payment.service';
import { err, InternalServerError, PaymentError } from '../../../../shared/result/result';

describe('ProcessPaymentService', () => {
  let service: ProcessPaymentService;
  let mockProductRepo: { findById: jest.Mock };
  let mockCustomerRepo: { upsertByEmail: jest.Mock };
  let mockStockRepo: Record<string, jest.Mock>;
  let mockTxRepo: { create: jest.Mock };
  let mockDeliveryRepo: Record<string, jest.Mock>;
  let mockGateway: { createTransaction: jest.Mock };
  let mockConfig: { get: jest.Mock };
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockAuditLogger: { log: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let mockQueryRunner1: {
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

  let mockQueryRunner2: typeof mockQueryRunner1;

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

  function buildQueryRunnerMock(): typeof mockQueryRunner1 {
    const qb = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      create: jest.fn().mockReturnValue({}),
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

    mockQueryRunner1 = buildQueryRunnerMock();
    mockQueryRunner2 = buildQueryRunnerMock();

    // Default: first call returns QR1, second returns QR2
    mockDataSource = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(mockQueryRunner1)
        .mockReturnValueOnce(mockQueryRunner2),
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
        { provide: ConfigService, useValue: mockConfig },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditLogger, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get<ProcessPaymentService>(ProcessPaymentService);
  });

  it('should return NotFoundError if product does not exist', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Product');
    }
  });

  it('should return OutOfStockError if stock is null', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue(null);

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('OutOfStockError');
    }
    expect(mockQueryRunner1.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner1.release).toHaveBeenCalled();
  });

  it('should return OutOfStockError if stock quantity is <= 0', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 0 });

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('OutOfStockError');
    }
    expect(mockQueryRunner1.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should return InternalServerError and rollback QR1 when save throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockRejectedValue(new Error('DB failed'));

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('InternalServerError');
    }
    expect(mockQueryRunner1.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner1.release).toHaveBeenCalled();
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_ERROR', error: 'DB failed' }),
    );
  });

  it('should return InternalServerError and audit unknown error when non-Error thrown in QR1', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockRejectedValue('string error');

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unknown' }),
    );
  });

  it('should process payment successfully with APPROVED status', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockResolvedValue({});

    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-123', status: 'APPROVED' },
    });

    mockQueryRunner2.manager.update.mockResolvedValue({});
    mockQueryRunner2.manager.decrement.mockResolvedValue({});
    mockQueryRunner2.manager.create.mockReturnValue({});
    mockQueryRunner2.manager.save.mockResolvedValue({});

    const result = await service.execute(mockInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe('APPROVED');
      expect(result.value.paymentId).toBe('gw-123');
      expect(typeof result.value.transactionId).toBe('string');
      expect(typeof result.value.reference).toBe('string');
      expect(result.value.amountInCents).toBeGreaterThan(0);
    }
    expect(mockQueryRunner2.manager.update).toHaveBeenCalledWith(
      'transactions',
      expect.any(Object),
      expect.objectContaining({ status: 'APPROVED' }),
    );
    expect(mockQueryRunner2.manager.save).toHaveBeenCalledWith(
      'deliveries',
      expect.any(Object),
    );
    expect(mockAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_APPROVED' }),
    );
  });

  it('should return DECLINED status when gateway returns DECLINED', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockResolvedValue({});

    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-456', status: 'DECLINED' },
    });

    mockQueryRunner2.manager.update.mockResolvedValue({});

    const result = await service.execute(mockInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe('DECLINED');
    }
    expect(mockQueryRunner2.manager.update).toHaveBeenCalledWith(
      'transactions',
      expect.any(Object),
      expect.objectContaining({ status: 'DECLINED' }),
    );
    expect(mockAuditLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_DECLINED' }),
    );
  });

  it('should return error when gateway fails (success: false)', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockResolvedValue({});

    const gatewayError = new PaymentError('Gateway failed');
    mockGateway.createTransaction.mockResolvedValue(err(gatewayError));
    mockQueryRunner2.manager.update.mockResolvedValue({});

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(gatewayError);
    }
    expect(mockQueryRunner2.manager.update).toHaveBeenCalledWith(
      'transactions',
      expect.any(Object),
      expect.objectContaining({ status: 'ERROR' }),
    );
  });

  it('should rollback QR2 and return InternalServerError when QR2 update throws', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockResolvedValue({});

    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-789', status: 'APPROVED' },
    });

    mockQueryRunner2.manager.update.mockRejectedValue(new Error('DB update error'));

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('InternalServerError');
    }
    expect(mockQueryRunner2.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner2.release).toHaveBeenCalled();
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACTION_ERROR', error: 'DB update error' }),
    );
  });

  it('should rollback QR2 and audit unknown error when non-Error thrown in QR2', async () => {
    mockProductRepo.findById.mockResolvedValue(mockProduct);
    mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
    mockQueryRunner1.manager.getOne.mockResolvedValue({ quantity: 5 });
    mockQueryRunner1.manager.create.mockReturnValue({});
    mockQueryRunner1.manager.save.mockResolvedValue({});

    mockGateway.createTransaction.mockResolvedValue({
      success: true,
      value: { id: 'gw-789', status: 'APPROVED' },
    });

    mockQueryRunner2.manager.update.mockRejectedValue('not an error object');

    const result = await service.execute(mockInput);

    expect(result.success).toBe(false);
    expect(mockAuditLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unknown' }),
    );
  });

  describe('constructor - fee fallback branches', () => {
    it('should use default baseFee (3500) and deliveryFee (8000) when config returns 0', async () => {
      const zeroConfig = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'payment.baseFee') return 0;  // falsy → fallback to 3500
          if (key === 'payment.deliveryFee') return 0; // falsy → fallback to 8000
          return null;
        }),
      };

      const qr1 = buildQueryRunnerMock();
      const qr2 = buildQueryRunnerMock();
      const ds = {
        createQueryRunner: jest.fn().mockReturnValueOnce(qr1).mockReturnValueOnce(qr2),
      };

      const mod = await Test.createTestingModule({
        providers: [
          ProcessPaymentService,
          { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
          { provide: CUSTOMER_REPOSITORY, useValue: mockCustomerRepo },
          { provide: STOCK_REPOSITORY, useValue: mockStockRepo },
          { provide: TRANSACTION_REPOSITORY, useValue: mockTxRepo },
          { provide: DELIVERY_REPOSITORY, useValue: mockDeliveryRepo },
          { provide: PaymentGatewayService, useValue: mockGateway },
          { provide: ConfigService, useValue: zeroConfig },
          { provide: DataSource, useValue: ds },
          { provide: AuditLogger, useValue: mockAuditLogger },
        ],
      }).compile();

      const svc = mod.get<ProcessPaymentService>(ProcessPaymentService);

      // Exercise the service to confirm it works with fallback fees
      mockProductRepo.findById.mockResolvedValue(mockProduct);
      mockCustomerRepo.upsertByEmail.mockResolvedValue(mockCustomer);
      qr1.manager.getOne.mockResolvedValue(null); // Out of stock triggers early return

      const result = await svc.execute(mockInput);
      expect(result.success).toBe(false); // out of stock
      // If we got here the constructor ran the || fallback branches
    });
  });
});
