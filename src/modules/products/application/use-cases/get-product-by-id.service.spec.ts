import { Test, TestingModule } from '@nestjs/testing';
import { GetProductByIdService } from './get-product-by-id.service';

describe('GetProductByIdService', () => {
  let service: GetProductByIdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetProductByIdService],
    }).compile();

    service = module.get<GetProductByIdService>(GetProductByIdService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
