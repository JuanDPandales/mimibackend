import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway/payment-gateway.service';

@Module({
  providers: [PaymentGatewayService]
})
export class AuditModule {}
