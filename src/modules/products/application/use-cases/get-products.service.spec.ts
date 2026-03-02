import { Test, TestingModule } from '@nestjs/testing';
import { GetProductsUseCase, ProductWithStock } from './get-products.service';
import { PRODUCT_REPOSITORY } from '../../domain/product.repository';
import { STOCK_REPOSITORY } from '../../../stock/domain/stock.repository';
import { Product } from '../../domain/product.entity';

describe('GetProductsUseCase', () => {
  let service: GetProductsUseCase;
  let mockProductRepo: { findAll: jest.Mock };
  let mockStockRepo: { findByProductId: jest.Mock };

  const now = new Date();

  function makeProduct(id: string, price: number): Product {
    return {
      id,
      name: `Product ${id}`,
      description: 'desc',
      price,
      imageUrl: 'http://img.url',
      category: 'toys',
      createdAt: now,
    };
  }

  beforeEach(async () => {
    mockProductRepo = { findAll: jest.fn() };
    mockStockRepo = { findByProductId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetProductsUseCase,
        { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
        { provide: STOCK_REPOSITORY, useValue: mockStockRepo },
      ],
    }).compile();

    service = module.get<GetProductsUseCase>(GetProductsUseCase);
  });

  it('should return all products with their stock quantities', async () => {
    const products = [makeProduct('p-1', 1000), makeProduct('p-2', 2000)];
    mockProductRepo.findAll.mockResolvedValue(products);
    mockStockRepo.findByProductId.mockImplementation((id: string) =>
      Promise.resolve(id === 'p-1' ? { quantity: 5 } : { quantity: 0 }),
    );

    const result = await service.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({ id: 'p-1', stock: 5 });
      expect(result.value[1]).toMatchObject({ id: 'p-2', stock: 0 });
    }
  });

  it('should return stock: 0 when stock record is null (nullish coalescing branch)', async () => {
    const products = [makeProduct('p-1', 1000)];
    mockProductRepo.findAll.mockResolvedValue(products);
    mockStockRepo.findByProductId.mockResolvedValue(null);

    const result = await service.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value[0].stock).toBe(0);
    }
  });

  it('should return an empty array of products when repository returns empty', async () => {
    mockProductRepo.findAll.mockResolvedValue([]);

    const result = await service.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual([]);
    }
  });
});
