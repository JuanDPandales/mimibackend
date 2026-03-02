import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { PaymentGatewayService } from '../../../shared/payment-gateway/payment-gateway.service';
import { AuditLogger } from '../../../shared/audit/audit.logger';
import { DataSource } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockGatewayService: { verifyWebhookSignature: jest.Mock };
  let mockAuditLogger: { log: jest.Mock; warn: jest.Mock };
  let mockDataSource: { manager: { update: jest.Mock } };

  beforeEach(async () => {
    mockGatewayService = {
      verifyWebhookSignature: jest.fn(),
    };

    mockAuditLogger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    mockDataSource = {
      manager: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: PaymentGatewayService, useValue: mockGatewayService },
        { provide: AuditLogger, useValue: mockAuditLogger },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handlePaymentWebhook()', () => {
    it('should throw UnauthorizedException if transaction is missing (empty payload)', async () => {
      const payload = {};
      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'WEBHOOK_RECEIVED' }),
      );
    });

    it('should throw UnauthorizedException if reference is missing', async () => {
      const payload = {
        data: {
          transaction: {
            amount_in_cents: 1000,
            currency: 'COP',
            status: 'APPROVED',
          },
        },
        signature: { checksum: 'sig' },
      };
      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if signature (checksum) is missing', async () => {
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
            amount_in_cents: 1000,
            currency: 'COP',
            status: 'APPROVED',
          },
        },
        signature: {},
      };
      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if amountInCents is not a number', async () => {
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
            currency: 'COP',
            status: 'APPROVED',
          },
        },
        signature: { checksum: 'sig' },
      };
      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if currency is not a string', async () => {
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
            amount_in_cents: 1000,
            status: 'APPROVED',
          },
        },
        signature: { checksum: 'sig' },
      };
      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if status is not a string', async () => {
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
            amount_in_cents: 1000,
            currency: 'COP',
          },
        },
        signature: { checksum: 'sig' },
      };
      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException and audit WEBHOOK_SIGNATURE_INVALID if signature is invalid', async () => {
      mockGatewayService.verifyWebhookSignature.mockReturnValue(false);
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
            amount_in_cents: 1000,
            currency: 'COP',
            status: 'APPROVED',
            created_at: 'now',
          },
        },
        signature: { checksum: 'bad-sig' },
      };

      await expect(controller.handlePaymentWebhook(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuditLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'WEBHOOK_SIGNATURE_INVALID' }),
      );
    });

    it('should update transaction and return received:true if signature is valid', async () => {
      mockGatewayService.verifyWebhookSignature.mockReturnValue(true);
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
            amount_in_cents: 1000,
            currency: 'COP',
            status: 'APPROVED',
            created_at: 'now',
          },
        },
        signature: { checksum: 'good-sig' },
      };

      const response = await controller.handlePaymentWebhook(payload);

      expect(response).toEqual({ received: true });
      expect(mockDataSource.manager.update).toHaveBeenCalledWith(
        'transactions',
        { reference: 'ref-1' },
        expect.objectContaining({ status: 'APPROVED' }),
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'WEBHOOK_SIGNATURE_VALID' }),
      );
    });

    it('should use default values (0, empty string) when optional fields are missing', async () => {
      // This covers the `|| 0`, `|| ''` fallback branches in verifyWebhookSignature call
      mockGatewayService.verifyWebhookSignature.mockReturnValue(true);
      const payload = {
        data: {
          transaction: {
            reference: 'ref-2',
            amount_in_cents: 500,
            currency: 'USD',
            status: 'DECLINED',
            // no created_at: undefined → uses ''
          },
        },
        signature: { checksum: 'valid-sig-2' },
      };

      await controller.handlePaymentWebhook(payload);

      // verifyWebhookSignature called with timestamp = '' (|| '' branch covered)
      expect(mockGatewayService.verifyWebhookSignature).toHaveBeenCalledWith(
        'ref-2',
        500,
        'USD',
        'DECLINED',
        'valid-sig-2',
        '',
      );
    });
  });
});
