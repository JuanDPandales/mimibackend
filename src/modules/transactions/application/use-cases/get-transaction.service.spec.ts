import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionService } from './get-transaction.service';

describe('GetTransactionService', () => {
  let service: GetTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetTransactionService],
    }).compile();

    service = module.get<GetTransactionService>(GetTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
