import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

export type AuditEvent =
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_APPROVED'
  | 'TRANSACTION_DECLINED'
  | 'TRANSACTION_ERROR'
  | 'STOCK_DECREMENTED'
  | 'DELIVERY_CREATED'
  | 'IDEMPOTENCY_HIT'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_SIGNATURE_VALID'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IDEMPOTENCY_SAVE_ERROR';

export interface AuditPayload {
  event: AuditEvent;
  transactionId?: string;
  reference?: string;
  productId?: string;
  customerId?: string;
  amountInCents?: number;
  status?: string;
  ip?: string;
  idempotencyKey?: string;
  gatewayId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogger {

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) { }

  log(payload: AuditPayload): void {
    this.logger.info(payload.event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  error(payload: AuditPayload): void {
    this.logger.error(payload.event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  warn(payload: AuditPayload): void {
    this.logger.warn(payload.event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
