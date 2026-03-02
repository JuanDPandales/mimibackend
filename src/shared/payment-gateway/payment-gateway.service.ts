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
import { AuditLogger } from '../audit/audit.logger';

export interface PaymentGatewayTransactionResult {
  id: string;
  reference: string;
  status: 'APPROVED' | 'DECLINED' | 'ERROR' | 'PENDING' | 'VOIDED';
  paymentMethodType?: string;
}

export interface CreateTransactionInput {
  cardToken: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  reference: string;
}

export interface TokenizeCardInput {
  number: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

@Injectable()
export class PaymentGatewayService {
  private readonly apiUrl: string;
  private readonly pubKey: string;
  private readonly prvKey: string;
  private readonly eventsKey: string;
  private readonly integrityKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditLogger,
  ) {
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

    // Safe debug log to verify keys are loaded without exposing them fully
    if (process.env.NODE_ENV !== 'production') {
      this.audit.log({
        event: 'TRANSACTION_CREATED',
        metadata: {
          info: 'Checking Gateway Keys prefixes',
          pub_p: this.pubKey?.substring(0, 8),
          prv_p: this.prvKey?.substring(0, 8),
          int_p: this.integrityKey ? 'LOADED' : 'MISSING',
        },
      });
    }
  }

  /**
   * Step 1: Get the current Acceptance Token from the Payment Gateway (required for every transaction)
   */
  async getAcceptanceToken(): Promise<Result<string>> {
    try {
      const response = await fetch(`${this.apiUrl}/merchants/${this.pubKey}`);
      if (!response.ok) {
        return err(new InternalServerError('Failed to fetch merchant data from Payment Gateway'));
      }
      const data = await response.json() as any;
      const token = data?.data?.presigned_acceptance?.acceptance_token;
      if (!token) {
        return err(new InternalServerError('Acceptance token not found in Payment Gateway response'));
      }
      return ok(token as string);
    } catch (e) {
      return err(new InternalServerError('Failed to obtain acceptance token from Payment Gateway'));
    }
  }

  /**
   * Step 2: Tokenize a credit card (returns a token like tok_stagtest_...)
   */
  async tokenizeCard(input: TokenizeCardInput): Promise<Result<string>> {
    try {
      const response = await fetch(`${this.apiUrl}/tokens/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.pubKey}`,
        },
        body: JSON.stringify({
          number: input.number,
          cvc: input.cvc,
          exp_month: input.expMonth,
          exp_year: input.expYear,
          card_holder: input.cardHolder,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || data?.status !== 'CREATED') {
        return err(new PaymentError(data?.error?.messages?.join(', ') ?? 'Failed to tokenize card'));
      }

      return ok(data.data.id as string);
    } catch (e) {
      return err(new InternalServerError('Failed to tokenize card with Payment Gateway'));
    }
  }

  /**
   * Step 3: Create the transaction in Payment Gateway with the card token
   * Uses the Payment Gateway private key for server-to-server calls
   */
  async createTransaction(
    input: CreateTransactionInput,
  ): Promise<Result<PaymentGatewayTransactionResult>> {
    try {
      // 3a. Get acceptance token (required by Payment Gateway for every transaction)
      const acceptanceTokenResult = await this.getAcceptanceToken();
      if (!acceptanceTokenResult.success) {
        return err(acceptanceTokenResult.error);
      }
      const acceptanceToken = acceptanceTokenResult.value;

      // 3b. Generate integrity signature
      const signature = this.generateSignature(
        input.reference,
        input.amountInCents,
        input.currency,
      );

      // 3c. Create transaction in Payment Gateway Sandbox
      const response = await fetch(`${this.apiUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.prvKey}`,
        },
        body: JSON.stringify({
          amount_in_cents: input.amountInCents,
          currency: input.currency,
          customer_email: input.customerEmail,
          reference: input.reference,
          acceptance_token: acceptanceToken,
          payment_method: {
            type: 'CARD',
            installments: 1,
            token: input.cardToken,
          },
          customer_data: {
            full_name: input.customerName,
            phone_number: input.customerPhone,
          },
          signature,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        // Log the full error for debugging (Development only)
        if (process.env.NODE_ENV !== 'production') {
          this.audit.error({
            event: 'TRANSACTION_ERROR',
            metadata: {
              http_status: response.status,
              error_data: data,
            },
          });
        }

        let errorMsg: string;
        if (data?.error?.messages) {
          errorMsg = Object.values(data.error.messages)
            .flat()
            .map((m) => (typeof m === 'object' ? JSON.stringify(m) : m))
            .join(', ');
        } else if (typeof data?.error?.reason === 'object') {
          errorMsg = JSON.stringify(data.error.reason);
        } else {
          errorMsg = data?.error?.reason ?? data?.error?.type ?? 'Payment Gateway rejected the transaction';
        }
        return err(new PaymentError(errorMsg));
      }

      const tx = data?.data;
      if (!tx) {
        return err(new InternalServerError('Unexpected response from Payment Gateway'));
      }

      return ok({
        id: tx.id,
        reference: tx.reference,
        status: tx.status as PaymentGatewayTransactionResult['status'],
        paymentMethodType: tx.payment_method_type,
      });
    } catch (e) {
      return err(
        new PaymentError(
          'An error occurred during communication with the Payment Gateway',
        ),
      );
    }
  }

  generateSignature(
    reference: string,
    amountInCents: number,
    currency: string,
  ): string {
    // Standard integrity signature chain: reference + amountInCents + currency + integrityKey
    // Note: ensure amount is treated as a string of the integer value
    const amountStr = Math.floor(amountInCents).toString();
    const payload = `${reference}${amountStr}${currency}${this.integrityKey}`;

    // Debug log to help identify signature mismatches (Development only)
    if (process.env.NODE_ENV !== 'production') {
      this.audit.log({
        event: 'TRANSACTION_CREATED',
        metadata: {
          debug_signature_chain: `${reference}${amountStr}${currency}***`,
        },
      });
    }

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  verifyWebhookSignature(
    transactionId: string,
    status: string,
    amountInCents: number,
    timestamp: string,
    signature: string,
  ): boolean {
    const payload = `${transactionId}${status}${amountInCents}${timestamp}${this.eventsKey}`;

    if (process.env.NODE_ENV !== 'production') {
      this.audit.log({
        event: 'WEBHOOK_RECEIVED',
        metadata: {
          chain: `${transactionId}${status}${amountInCents}${timestamp}***`,
        },
      });
    }

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
