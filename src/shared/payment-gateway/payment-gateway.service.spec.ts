import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGatewayService } from './payment-gateway.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AuditLogger } from '../audit/audit.logger';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;
  let config: ConfigService;
  let audit: { log: jest.Mock; error: jest.Mock; warn: jest.Mock };

  const defaultConfigMap: Record<string, string> = {
    'payment.gatewaySandboxUrl': 'gatewaySandboxUrl',
    'payment.gatewayPubKey': 'pub_test_key',
    'payment.gatewayPrvKey': 'prv_test_key',
    'payment.gatewayEventsKey': 'test_events_key',
    'payment.gatewayIntegrityKey': 'test_integrity_key',
  };

  async function buildService(
    configOverrides: Record<string, string | undefined> = {},
  ): Promise<PaymentGatewayService> {
    const module = await Test.createTestingModule({
      providers: [
        PaymentGatewayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (Object.prototype.hasOwnProperty.call(configOverrides, key)) {
                return configOverrides[key];
              }
              return defaultConfigMap[key] ?? undefined;
            }),
          },
        },
        {
          provide: AuditLogger,
          useFactory: () => audit,
        },
      ],
    }).compile();
    config = module.get<ConfigService>(ConfigService);
    return module.get<PaymentGatewayService>(PaymentGatewayService);
  }

  beforeEach(async () => {
    jest.restoreAllMocks();
    audit = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    service = await buildService();
    global.fetch = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor config/env fallbacks', () => {
    it('uses env fallbacks when config values are missing', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevSandbox = process.env.GATEWAY_SANDBOX_URL;
      const prevPub = process.env.GATEWAY_PUB_KEY;

      try {
        process.env.NODE_ENV = 'production';
        process.env.GATEWAY_SANDBOX_URL = 'https://env-gw';
        process.env.GATEWAY_PUB_KEY = 'env_pub';

        const svc = await buildService({
          'payment.gatewaySandboxUrl': undefined,
          'payment.gatewayPubKey': undefined,
          'payment.gatewayPrvKey': undefined,
          'payment.gatewayEventsKey': undefined,
          'payment.gatewayIntegrityKey': undefined,
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

        await svc.getAcceptanceToken();
        expect(global.fetch).toHaveBeenCalledWith('https://env-gw/merchants/env_pub');
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.GATEWAY_SANDBOX_URL = prevSandbox;
        process.env.GATEWAY_PUB_KEY = prevPub;
      }
    });

    it('falls back to empty strings when both config and env are missing', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevSandbox = process.env.GATEWAY_SANDBOX_URL;
      const prevPub = process.env.GATEWAY_PUB_KEY;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.GATEWAY_SANDBOX_URL;
        delete process.env.GATEWAY_PUB_KEY;

        const svc = await buildService({
          'payment.gatewaySandboxUrl': undefined,
          'payment.gatewayPubKey': undefined,
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

        await svc.getAcceptanceToken();
        expect(global.fetch).toHaveBeenCalledWith('/merchants/');
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.GATEWAY_SANDBOX_URL = prevSandbox;
        process.env.GATEWAY_PUB_KEY = prevPub;
      }
    });
  });

  // ─── getAcceptanceToken ───────────────────────────────────────────────────────

  describe('getAcceptanceToken()', () => {
    it('should return a success result with the acceptance token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            presigned_acceptance: {
              acceptance_token: 'valid_token',
            },
          },
        }),
      });

      const result = await service.getAcceptanceToken();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('valid_token');
      }
    });

    it('should return error if response is not ok (line 96)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      const result = await service.getAcceptanceToken();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('merchant data');
      }
    });

    it('should return error if acceptance_token is missing from response (line 101)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            presigned_acceptance: {}, // no acceptance_token
          },
        }),
      });

      const result = await service.getAcceptanceToken();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Acceptance token not found');
      }
    });

    it('should return error if fetch throws (network error)', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );
      const result = await service.getAcceptanceToken();
      expect(result.success).toBe(false);
    });
  });

  // ─── tokenizeCard ─────────────────────────────────────────────────────────────

  describe('tokenizeCard()', () => {
    const tokenizeInput = {
      number: '4242424242424242',
      cvc: '123',
      expMonth: '12',
      expYear: '26',
      cardHolder: 'Test User',
    };

    it('should return a token on success (lines 113-137)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'CREATED',
          data: { id: 'tok_stagtest_abc123' },
        }),
      });

      const result = await service.tokenizeCard(tokenizeInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('tok_stagtest_abc123');
      }
    });

    it('should return error if response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { messages: ['Invalid card number'] },
        }),
      });

      const result = await service.tokenizeCard(tokenizeInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid card number');
      }
    });

    it('should return error if status is not CREATED', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ERROR',
          data: {},
        }),
      });

      const result = await service.tokenizeCard(tokenizeInput);
      expect(result.success).toBe(false);
    });

    it('should return error if tokenizeCard fails with no error messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}), // no error.messages
      });

      const result = await service.tokenizeCard(tokenizeInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('tokenize card');
      }
    });

    it('should return InternalServerError if fetch throws', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await service.tokenizeCard(tokenizeInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('tokenize card');
      }
    });
  });

  // ─── createTransaction ───────────────────────────────────────────────────────

  describe('createTransaction()', () => {
    const baseInput = {
      cardToken: 'tok_test',
      amountInCents: 150000,
      currency: 'COP',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      customerPhone: '1234567890',
      reference: 'ref_001',
    };

    it('should create a transaction successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            presigned_acceptance: { acceptance_token: 'acc_123' },
          },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'payment_tx_id_001',
            reference: 'ref_001',
            status: 'APPROVED',
            payment_method_type: 'CARD',
          },
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('payment_tx_id_001');
        expect(result.value.status).toBe('APPROVED');
      }
    });

    it('should return error if getAcceptanceToken fails (line 152)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
    });

    it('should return PaymentError with messages array when gateway returns error.messages (lines 209-212)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            messages: {
              card: ['Card is expired', 'Invalid CVV'],
            },
          },
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Card is expired');
      }
    });

    it('should stringify object messages in error.messages arrays', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            messages: {
              card: [{ code: 'X', message: 'nested' }],
            },
          },
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('"code":"X"');
      }
    });

    it('should return PaymentError with stringified reason when error.reason is an object (line 219)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            reason: { code: 'BLOCKED', detail: 'Issuer blocked' },
          },
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('BLOCKED');
      }
    });

    it('should return PaymentError with reason string as fallback', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            reason: 'INVALID_ACCESS_TOKEN',
          },
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('INVALID_ACCESS_TOKEN');
      }
    });

    it('should use error.type when reason is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            type: 'FORBIDDEN',
          },
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('FORBIDDEN');
      }
    });

    it('should return error if response is not ok with no error body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}), // no error field
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('rejected');
      }
    });

    it('should return InternalServerError if transaction data is null/missing (line 229)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: null, // tx is null
        }),
      });

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unexpected response');
      }
    });

    it('should return PaymentError if fetch throws during createTransaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { presigned_acceptance: { acceptance_token: 'acc_123' } },
        }),
      });
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Connection reset'),
      );

      const result = await service.createTransaction(baseInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Payment Gateway');
      }
    });

    it('logs gateway error details when not in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'test';

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              presigned_acceptance: { acceptance_token: 'acc_123' },
            },
          }),
        });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: { type: 'BAD_REQUEST' },
          }),
        });

        await service.createTransaction(baseInput);

        expect(audit.error).toHaveBeenCalledWith(
          expect.objectContaining({ event: 'TRANSACTION_ERROR' }),
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  // ─── generateSignature ───────────────────────────────────────────────────────

  describe('generateSignature()', () => {
    it('should generate a valid sha256 hex string', () => {
      const signature = service.generateSignature('ref1', 1000, 'COP');
      expect(typeof signature).toBe('string');
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should floor decimal amounts before hashing', () => {
      const sig1 = service.generateSignature('ref1', 1000.9, 'COP');
      const sig2 = service.generateSignature('ref1', 1000, 'COP');
      expect(sig1).toBe(sig2);
    });

    it('does not emit debug log in production', () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        audit.log.mockClear(); // ignore constructor log from beforeEach

        service.generateSignature('ref-prod', 1000, 'COP');
        expect(audit.log).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('emits debug log when not in production', () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'test';
        audit.log.mockClear(); // ignore constructor log from beforeEach

        service.generateSignature('ref-test', 1000, 'COP');
        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({ event: 'TRANSACTION_CREATED' }),
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  // ─── verifyWebhookSignature ───────────────────────────────────────────────────

  describe('verifyWebhookSignature()', () => {
    it('should return true for a valid signature', () => {
      const eventsKey = 'test_events_key';
      const transactionId = 'tx_123';
      const status = 'APPROVED';
      const amountInCents = 1000;
      const timestamp = '123456789';
      const payload = `${transactionId}${status}${amountInCents}${timestamp}${eventsKey}`;
      const validHash = crypto
        .createHash('sha256')
        .update(payload)
        .digest('hex');

      expect(
        service.verifyWebhookSignature(
          transactionId,
          status,
          amountInCents,
          timestamp,
          validHash,
        ),
      ).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      expect(
        service.verifyWebhookSignature(
          'tx_123',
          'APPROVED',
          1000,
          '123456789',
          'invalid_hash_value_that_is_wrong',
        ),
      ).toBe(false);
    });

    it('should return false when signature length matches but content differs', () => {
      const transactionId = 'tx_123';
      const status = 'APPROVED';
      const amountInCents = 1000;
      const timestamp = '123456789';
      const payload = `${transactionId}${status}${amountInCents}${timestamp}test_events_key`;
      const validHash = crypto
        .createHash('sha256')
        .update(payload)
        .digest('hex');

      const badHash = `${validHash[0] === 'a' ? 'b' : 'a'}${validHash.slice(1)}`;

      expect(
        service.verifyWebhookSignature(
          transactionId,
          status,
          amountInCents,
          timestamp,
          badHash,
        ),
      ).toBe(false);
    });

    it('should return false when signatures have different lengths (line 288)', () => {
      // A valid sha256 is 64 chars; providing a shorter hash forces length mismatch
      expect(
        service.verifyWebhookSignature(
          'tx_123',
          'APPROVED',
          1000,
          '123456789',
          'short',
        ),
      ).toBe(false);
    });

    it('does not emit webhook debug log in production', () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        audit.log.mockClear(); // ignore constructor log from beforeEach

        service.verifyWebhookSignature('tx', 'APPROVED', 1, 't', 'short');
        expect(audit.log).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});