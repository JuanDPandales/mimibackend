import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundError,
  ValidationError,
  err,
  ok,
} from '../../../shared/result/result';
import { GetTransactionUseCase } from '../application/use-cases/get-transaction.service';
import { ProcessPaymentService } from '../application/use-cases/process-payment.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { TransactionsController } from './transactions.controller';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let mockProcessPaymentService: { execute: jest.Mock };
  let mockGetTxUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    mockProcessPaymentService = {
      execute: jest.fn(),
    };

    mockGetTxUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: ProcessPaymentService, useValue: mockProcessPaymentService },
        { provide: GetTransactionUseCase, useValue: mockGetTxUseCase },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should return result value if processing is successful', async () => {
      const dto: ProcessPaymentDto = {
        productId: 'prod-1',
        cardToken: 'tok',
        customerName: 'Juan',
        customerEmail: 'juan@test.com',
        customerPhone: '123',
        deliveryAddress: 'Casa',
        deliveryCity: 'Bogota',
        deliveryDepartment: 'Bogota DC',
      };

      const expectedOutput = {
        transactionId: 'tx-1',
        reference: 'ref-1',
        status: 'APPROVED',
        paymentId: 'gw-1',
        amountInCents: 15000,
      };

      mockProcessPaymentService.execute.mockResolvedValue(ok(expectedOutput));

      const result = await controller.createTransaction(dto);
      expect(result).toEqual(expectedOutput);
      expect(mockProcessPaymentService.execute).toHaveBeenCalledWith(dto);
    });

    it('should throw an error if processing fails', async () => {
      const dto = {} as ProcessPaymentDto;
      const error = new ValidationError('Some error');
      mockProcessPaymentService.execute.mockResolvedValue(err(error));

      await expect(controller.createTransaction(dto)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('getTransaction', () => {
    it('should return transaction if found', async () => {
      const expectedTx = { id: 'tx-1', status: 'APPROVED' };
      mockGetTxUseCase.execute.mockResolvedValue(ok(expectedTx));

      const result = await controller.getTransaction('ref-1');
      expect(result).toEqual(expectedTx);
      expect(mockGetTxUseCase.execute).toHaveBeenCalledWith('ref-1');
    });

    it('should throw if transaction not found', async () => {
      const error = new NotFoundError('Not found');
      mockGetTxUseCase.execute.mockResolvedValue(err(error));

      await expect(controller.getTransaction('ref-1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
