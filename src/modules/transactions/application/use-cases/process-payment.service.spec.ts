import { Test, TestingModule } from '@nestjs/testing';
import { ProcessPaymentService } from './process-payment.service';

describe('ProcessPaymentService', () => {
  let service: ProcessPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessPaymentService],
    }).compile();

    service = module.get<ProcessPaymentService>(ProcessPaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
