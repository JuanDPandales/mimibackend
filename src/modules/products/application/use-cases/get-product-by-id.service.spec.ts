import { Test, TestingModule } from '@nestjs/testing';
import { GetProductByIdUseCase } from './get-product-by-id.service';
import { PRODUCT_REPOSITORY } from '../../domain/product.repository';
import { STOCK_REPOSITORY } from '../../../stock/domain/stock.repository';

describe('GetProductByIdUseCase', () => {
  let service: GetProductByIdUseCase;
  let mockProductRepo: { findById: jest.Mock };
  let mockStockRepo: { findByProductId: jest.Mock };

  beforeEach(async () => {
    mockProductRepo = { findById: jest.fn() };
    mockStockRepo = { findByProductId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetProductByIdUseCase,
        { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
        { provide: STOCK_REPOSITORY, useValue: mockStockRepo },
      ],
    }).compile();

    service = module.get<GetProductByIdUseCase>(GetProductByIdUseCase);
  });

  it('should return a product with stock when it exists and stock is found', async () => {
    const product = { id: 'p-1', name: 'Toy', price: 1000 };
    mockProductRepo.findById.mockResolvedValue(product);
    mockStockRepo.findByProductId.mockResolvedValue({ quantity: 7 });

    const result = await service.execute('p-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toMatchObject({ id: 'p-1', stock: 7 });
    }
  });

  it('should return stock: 0 when stock is null (nullish coalescing branch)', async () => {
    const product = { id: 'p-1', name: 'Toy', price: 1000 };
    mockProductRepo.findById.mockResolvedValue(product);
    mockStockRepo.findByProductId.mockResolvedValue(null);

    const result = await service.execute('p-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.stock).toBe(0);
    }
  });

  it('should return NotFoundError if product does not exist', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    const result = await service.execute('invalid-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.constructor.name).toBe('NotFoundError');
    }
  });
});
