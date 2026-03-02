import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { PaymentGatewayService } from '../../../shared/payment-gateway/payment-gateway.service';
import { AuditLogger } from '../../../shared/audit/audit.logger';
import { DataSource } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { FinalizeTransactionService } from '../application/use-cases/finalize-transaction.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockGatewayService: { verifyWebhookSignature: jest.Mock };
  let mockFinalizeService: { execute: jest.Mock };
  let mockAuditLogger: { log: jest.Mock; warn: jest.Mock };
  let mockDataSource: { manager: { update: jest.Mock } };

  beforeEach(async () => {
    mockGatewayService = {
      verifyWebhookSignature: jest.fn(),
    };

    mockFinalizeService = {
      execute: jest.fn().mockResolvedValue(undefined),
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
        { provide: FinalizeTransactionService, useValue: mockFinalizeService },
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

    it('should throw UnauthorizedException if transaction ID is missing', async () => {
      const payload = {
        data: {
          transaction: {
            reference: 'ref-1',
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

    it('should throw UnauthorizedException if reference is missing', async () => {
      const payload = {
        data: {
          transaction: {
            id: 'id-1',
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
            id: 'id-1',
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

    it('should throw UnauthorizedException and audit WEBHOOK_SIGNATURE_INVALID if signature is invalid', async () => {
      mockGatewayService.verifyWebhookSignature.mockReturnValue(false);
      const payload = {
        data: {
          transaction: {
            id: 'id-1',
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

    it('should call finalizeService and return received:true if signature is valid', async () => {
      mockGatewayService.verifyWebhookSignature.mockReturnValue(true);
      const payload = {
        data: {
          transaction: {
            id: 'id-1',
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
      expect(mockFinalizeService.execute).toHaveBeenCalledWith({
        reference: 'ref-1',
        status: 'APPROVED',
        gatewayId: 'id-1',
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'WEBHOOK_SIGNATURE_VALID' }),
      );
    });
  });
});
