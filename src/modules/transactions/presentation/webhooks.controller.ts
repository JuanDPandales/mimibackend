import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AuditLogger } from '../../../shared/audit/audit.logger';
import { PaymentGatewayService } from '../../../shared/payment-gateway/payment-gateway.service';
import { FinalizeTransactionService } from '../application/use-cases/finalize-transaction.service';

export interface WebhookPayload {
  data?: {
    transaction?: {
      id?: string;
      reference?: string;
      amount_in_cents?: number;
      currency?: string;
      status?: string;
      created_at?: string;
    };
  };
  signature?: { checksum?: string };
}

@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {

  constructor(
    private readonly gatewayService: PaymentGatewayService,
    private readonly finalizeService: FinalizeTransactionService,
    private readonly audit: AuditLogger,
    private readonly dataSource: DataSource,
  ) { }

  @Post('payment')
  @HttpCode(200)
  async handlePaymentWebhook(@Body() payload: WebhookPayload) {
    this.audit.log({
      event: 'WEBHOOK_RECEIVED',
      metadata: { body: payload },
    });

    const {
      id: transactionId,
      reference,
      amount_in_cents: amountInCents,
      currency,
      status,
      created_at: timestamp,
    } = payload.data?.transaction || {};
    const signature = payload.signature?.checksum;

    if (
      !transactionId ||
      !reference ||
      !signature ||
      typeof amountInCents !== 'number' ||
      typeof currency !== 'string' ||
      typeof status !== 'string'
    ) {
      throw new UnauthorizedException('Invalid webhook payload structure');
    }

    const isValid = this.gatewayService.verifyWebhookSignature(
      transactionId,
      status,
      amountInCents,
      timestamp || '',
      signature,
    );

    if (!isValid) {
      this.audit.warn({
        event: 'WEBHOOK_SIGNATURE_INVALID',
        reference,
        metadata: { receivedSignature: signature },
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.audit.log({
      event: 'WEBHOOK_SIGNATURE_VALID',
      reference,
    });

    // Finalizar transacción usando el servicio compartido
    await this.finalizeService.execute({
      reference: reference,
      status: status,
      gatewayId: transactionId,
    });

    return { received: true };
  }
}
