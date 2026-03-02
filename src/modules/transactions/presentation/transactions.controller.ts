import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ProcessPaymentService,
  type ProcessPaymentOutput,
} from '../application/use-cases/process-payment.service';
import { GetTransactionUseCase } from '../application/use-cases/get-transaction.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Controller('transactions')
export class TransactionsController {

  constructor(
    private readonly processPaymentService: ProcessPaymentService,
    private readonly getTransactionUseCase: GetTransactionUseCase,
  ) { }

  @Post()
  @Throttle({ payment: { limit: 5, ttl: 60000 } })
  async createTransaction(
    @Body() input: ProcessPaymentDto,
  ): Promise<ProcessPaymentOutput> {
    const result = await this.processPaymentService.execute(input);

    if (!result.success) {
      throw result.error;
    }

    return result.value;
  }

  @Get(':reference')
  @Throttle({ read: { limit: 120, ttl: 60000 } })
  async getTransaction(@Param('reference') reference: string) {
    // La referencia normalmente es string custom alfanumérico. Si fuera UUID estricto usaríamos ParseUUIDPipe.
    // Asumiendo que reference es provista por nosotros pero no es garantizado UUID (el readme lo describe como reference).
    const result = await this.getTransactionUseCase.execute(reference);

    if (!result.success) {
      throw result.error;
    }

    return result.value;
  }
}
