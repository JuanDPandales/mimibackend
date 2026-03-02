import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StockController } from './stock.controller';
import { GetStockUseCase } from '../application/use-cases/get-stock.service';
import { ok, err, NotFoundError, InternalServerError } from '../../../shared/result/result';

describe('StockController', () => {
  let controller: StockController;
  let mockGetStockUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    mockGetStockUseCase = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [{ provide: GetStockUseCase, useValue: mockGetStockUseCase }],
    }).compile();

    controller = module.get<StockController>(StockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return stock DTO when stock is found', async () => {
    const mockStock = { id: 's1', productId: 'p1', quantity: 5, updatedAt: new Date() };
    mockGetStockUseCase.execute.mockResolvedValue(ok(mockStock));

    const result = await controller.getStockByProductId('p1');

    expect(result).toEqual({
      productId: 'p1',
      quantity: 5,
    });
    expect(mockGetStockUseCase.execute).toHaveBeenCalledWith('p1');
  });

  it('should throw NotFoundException when error.code is NOT_FOUND', async () => {
    mockGetStockUseCase.execute.mockResolvedValue(
      err(new NotFoundError('Stock not found for product p1')),
    );

    await expect(controller.getStockByProductId('p1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException for non-NOT_FOUND errors', async () => {
    mockGetStockUseCase.execute.mockResolvedValue(
      err(new InternalServerError('DB failure')),
    );

    await expect(controller.getStockByProductId('p1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
