import { Test, TestingModule } from '@nestjs/testing';
import { GetProductsService } from './get-products.service';

describe('GetProductsService', () => {
  let service: GetProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetProductsService],
    }).compile();

    service = module.get<GetProductsService>(GetProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
