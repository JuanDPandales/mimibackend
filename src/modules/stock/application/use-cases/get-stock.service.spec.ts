import { Test, TestingModule } from '@nestjs/testing';
import { GetStockService } from './get-stock.service';

describe('GetStockService', () => {
  let service: GetStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetStockService],
    }).compile();

    service = module.get<GetStockService>(GetStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
