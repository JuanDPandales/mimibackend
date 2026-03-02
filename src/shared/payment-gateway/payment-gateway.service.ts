import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  err,
  InternalServerError,
  ok,
  PaymentError,
  Result,
} from '../result/result';

export interface PaymentGatewayTransactionResult {
  id: string;
  reference: string;
  status: 'APPROVED' | 'DECLINED' | 'ERROR';
  paymentMethodType?: string;
}

export interface CreateTransactionInput {
  cardToken: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
  reference: string;
}

@Injectable()
export class PaymentGatewayService {
  private readonly apiUrl: string;
  private readonly pubKey: string;
  private readonly prvKey: string;
  private readonly eventsKey: string;
  private readonly integrityKey: string;


  constructor(private readonly config: ConfigService) {

    this.apiUrl =
      this.config.get<string>('payment.gatewaySandboxUrl') ??
      process.env.GATEWAY_SANDBOX_URL ??
      '';

    this.pubKey =
      this.config.get<string>('payment.gatewayPubKey') ??
      process.env.GATEWAY_PUB_KEY ??
      '';

    this.prvKey =
      this.config.get<string>('payment.gatewayPrvKey') ??
      process.env.GATEWAY_PRV_KEY ??
      '';

    this.eventsKey =
      this.config.get<string>('payment.gatewayEventsKey') ??
      process.env.GATEWAY_EVENTS_KEY ??
      '';

    this.integrityKey =
      this.config.get<string>('payment.gatewayIntegrityKey') ??
      process.env.GATEWAY_INTEGRITY_KEY ??
      '';
  }

  getAcceptanceToken(): Promise<Result<string>> {
    // Stub for API Call
    try {
      // Simulator: returning a fake acceptance token
      return Promise.resolve(ok('tok_sandbox_acceptance'));
    } catch /* istanbul ignore next */ {
      return Promise.resolve(
        err(new InternalServerError('Failed to obtain acceptance token')),
      );
    }
  }

  createTransaction(
    input: CreateTransactionInput,
  ): Promise<Result<PaymentGatewayTransactionResult>> {
    // En un caso real se usa axios o fetch contra this.apiUrl
    try {
      // MOCK behaviour logic to follow README example
      const isApproved = Math.random() > 0.2; // 80% Success Rate Simulator
      const status = isApproved ? 'APPROVED' : 'DECLINED';

      return Promise.resolve(
        ok({
          id: crypto.randomUUID(),
          reference: input.reference,
          status,
        }),
      );
    } catch /* istanbul ignore next */ {
      return Promise.resolve(
        err(
          new PaymentError(
            'An error occurred during communication with the Payment Gateway',
          ),
        ),
      );
    }
  }

  generateSignature(
    reference: string,
    amountInCents: number,
    currency: string,
  ): string {
    const payload = `${reference}${amountInCents}${currency}${this.integrityKey}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  verifyWebhookSignature(
    reference: string,
    amountInCents: number,
    currency: string,
    state: string,
    signature: string,
    timestamp: string,
  ): boolean {
    // Ejemplo de validación del webhook events_key {referencia}{monto}{moneda}{estado}{timestamp}{events_key}
    // Ajustado al Hash Sandbox de eventos
    const payload = `${reference}${amountInCents}${currency}${timestamp}${this.eventsKey}`;
    const calculatedSignature = crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex');

    try {
      const calculatedBuffer = Buffer.from(calculatedSignature);
      const providedBuffer = Buffer.from(signature);

      if (calculatedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(calculatedBuffer, providedBuffer);
    } catch /* istanbul ignore next */ {
      return false;
    }
  }
}
