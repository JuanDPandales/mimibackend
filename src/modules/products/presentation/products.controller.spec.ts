import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { GetProductsUseCase } from '../application/use-cases/get-products.service';
import { GetProductByIdUseCase } from '../application/use-cases/get-product-by-id.service';
import { ok, err, NotFoundError } from '../../../shared/result/result';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockGetProducts: { execute: jest.Mock };
  let mockGetProductById: { execute: jest.Mock };

  beforeEach(async () => {
    mockGetProducts = { execute: jest.fn() };
    mockGetProductById = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: GetProductsUseCase, useValue: mockGetProducts },
        { provide: GetProductByIdUseCase, useValue: mockGetProductById },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll()', () => {
    it('should return wrapped result when successful', async () => {
      const list = [{ id: '1', name: 'Product 1' }];
      mockGetProducts.execute.mockResolvedValue(ok(list));

      const result = await controller.findAll();
      expect(result).toEqual({ success: true, data: list });
    });

    it('should throw the error when use case fails', async () => {
      const error = new NotFoundError('Products');
      mockGetProducts.execute.mockResolvedValue(err(error));

      await expect(controller.findAll()).rejects.toThrow(NotFoundError);
    });
  });

  describe('findOne()', () => {
    it('should return wrapped result when product is found', async () => {
      const p = { id: 'p-1', name: 'Prod' };
      mockGetProductById.execute.mockResolvedValue(ok(p));

      const result = await controller.findOne('p-1');
      expect(result).toEqual({ success: true, data: p });
      expect(mockGetProductById.execute).toHaveBeenCalledWith('p-1');
    });

    it('should throw NotFoundError when product is not found', async () => {
      const error = new NotFoundError('Product');
      mockGetProductById.execute.mockResolvedValue(err(error));

      await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundError);
    });
  });
});
