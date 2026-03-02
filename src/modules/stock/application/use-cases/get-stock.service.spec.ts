import { Test, TestingModule } from '@nestjs/testing';
import { GetStockUseCase } from './get-stock.service';
import { STOCK_REPOSITORY } from '../../domain/stock.repository';

describe('GetStockUseCase', () => {
  let service: GetStockUseCase;
  let mockStockRepo: { findByProductId: jest.Mock };

  beforeEach(async () => {
    mockStockRepo = { findByProductId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetStockUseCase,
        { provide: STOCK_REPOSITORY, useValue: mockStockRepo },
      ],
    }).compile();

    service = module.get<GetStockUseCase>(GetStockUseCase);
  });

  it('should return the stock successfully', async () => {
    const s = { id: 's1', productId: 'p1', quantity: 5 };
    mockStockRepo.findByProductId.mockResolvedValue(s);
    const result = await service.execute('p1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual(s);
    }
  });

  it('should fail if stock record does not exist', async () => {
    mockStockRepo.findByProductId.mockResolvedValue(null);
    const result = await service.execute('invalid');
    expect(result.success).toBe(false);
  });
});
