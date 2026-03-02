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

export interface WebhookPayload {
  data?: {
    transaction?: {
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

    // We will map based on the implementation plan Sandbox example payload
    const {
      reference,
      amount_in_cents: amountInCents,
      currency,
      status,
      created_at: timestamp,
    } = payload.data?.transaction || {};
    const signature = payload.signature?.checksum;

    if (
      !reference ||
      !signature ||
      typeof amountInCents !== 'number' ||
      typeof currency !== 'string' ||
      typeof status !== 'string'
    ) {
      throw new UnauthorizedException('Invalid webhook payload structure');
    }

    const isValid = this.gatewayService.verifyWebhookSignature(
      reference,
      amountInCents || 0,
      currency || '',
      status || '',
      signature,
      timestamp || '',
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

    // Actualizar transacción
    await this.dataSource.manager.update(
      'transactions',
      { reference },
      { status, updated_at: new Date() },
    );

    return { received: true };
  }
}
