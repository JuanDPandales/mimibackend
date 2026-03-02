import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGatewayService } from './payment-gateway.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;

  const defaultConfigMap: Record<string, string> = {
    'payment.gatewaySandboxUrl': 'https://sandbox.example.com',
    'payment.gatewayPubKey': 'pub_test_key',
    'payment.gatewayPrvKey': 'prv_test_key',
    'payment.gatewayEventsKey': 'test_events_key',
    'payment.gatewayIntegrityKey': 'test_integrity_key',
  };

  async function buildService(configOverrides: Record<string, string | undefined> = {}): Promise<PaymentGatewayService> {
    const module = await Test.createTestingModule({
      providers: [
        PaymentGatewayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) =>
              configOverrides[key] ?? defaultConfigMap[key] ?? undefined,
            ),
          },
        },
      ],
    }).compile();
    return module.get<PaymentGatewayService>(PaymentGatewayService);
  }

  beforeEach(async () => {
    jest.restoreAllMocks();
    service = await buildService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor - config fallback branches', () => {
    it('should fall back to empty string when all config values return undefined', async () => {
      const svc = await buildService({
        'payment.gatewaySandboxUrl': undefined,
        'payment.gatewayPubKey': undefined,
        'payment.gatewayPrvKey': undefined,
        'payment.gatewayEventsKey': undefined,
        'payment.gatewayIntegrityKey': undefined,
      });
      expect(svc).toBeDefined();
    });
  });

  describe('getAcceptanceToken()', () => {
    it('should return a success result with the acceptance token', async () => {
      const result = await service.getAcceptanceToken();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('tok_sandbox_acceptance');
      }
    });
  });

  describe('createTransaction()', () => {
    it('should return a success result with id, reference, and status', async () => {
      const input = {
        cardToken: 'tok_test',
        amountInCents: 150000,
        currency: 'COP',
        customerEmail: 'test@example.com',
        reference: 'ref-001',
      };

      // Run multiple times to cover both APPROVED and DECLINED branches (80%/20%)
      let approvedCount = 0;
      let declinedCount = 0;
      for (let i = 0; i < 50; i++) {
        const result = await service.createTransaction(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.reference).toBe('ref-001');
          expect(['APPROVED', 'DECLINED']).toContain(result.value.status);
          if (result.value.status === 'APPROVED') approvedCount++;
          else declinedCount++;
        }
      }
      expect(approvedCount + declinedCount).toBe(50);
    });

    it('should use the provided reference in the result', async () => {
      const result = await service.createTransaction({
        cardToken: 'tok',
        amountInCents: 5000,
        currency: 'COP',
        customerEmail: 'user@example.com',
        reference: 'unique-ref-xyz',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.reference).toBe('unique-ref-xyz');
      }
    });
  });

  describe('generateSignature()', () => {
    it('should generate a valid sha256 hex string', () => {
      const signature = service.generateSignature('ref1', 1000, 'COP');
      expect(typeof signature).toBe('string');
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate consistent signatures for the same input', () => {
      const sig1 = service.generateSignature('ref1', 1000, 'COP');
      const sig2 = service.generateSignature('ref1', 1000, 'COP');
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different inputs', () => {
      const sig1 = service.generateSignature('ref1', 1000, 'COP');
      const sig2 = service.generateSignature('ref2', 2000, 'USD');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyWebhookSignature()', () => {
    it('should return true for a valid signature', () => {
      const eventsKey = 'test_events_key';
      const reference = 'ref1';
      const amountInCents = 1000;
      const currency = 'COP';
      const timestamp = 'now';
      const payload = `${reference}${amountInCents}${currency}${timestamp}${eventsKey}`;
      const validHash = crypto.createHash('sha256').update(payload).digest('hex');

      expect(service.verifyWebhookSignature(reference, amountInCents, currency, 'APPROVED', validHash, timestamp)).toBe(true);
    });

    it('should return false when signature has a different length (buffer length check)', () => {
      // 'short' is shorter than 64-char sha256 hex
      expect(service.verifyWebhookSignature('ref1', 1000, 'COP', 'APPROVED', 'short', 'now')).toBe(false);
    });

    it('should return false for a wrong but same-length (64-char) signature', () => {
      // Same length as sha256 hex output but wrong value → timingSafeEqual returns false
      expect(service.verifyWebhookSignature('ref1', 1000, 'COP', 'APPROVED', 'a'.repeat(64), 'now')).toBe(false);
    });
  });
});
