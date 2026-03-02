import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogger, AuditPayload } from './audit.logger';

describe('AuditLogger', () => {
    let auditLogger: AuditLogger;
    let mockWinstonLogger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };

    beforeEach(async () => {
        mockWinstonLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogger,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: mockWinstonLogger,
                },
            ],
        }).compile();

        auditLogger = module.get<AuditLogger>(AuditLogger);
    });

    const basePayload: AuditPayload = {
        event: 'TRANSACTION_CREATED',
        transactionId: 'tx-1',
        reference: 'ref-1',
        productId: 'prod-1',
        customerId: 'cust-1',
        amountInCents: 10000,
        status: 'PENDING',
        ip: '127.0.0.1',
        idempotencyKey: 'idem-key',
        gatewayId: 'gw-id',
        error: undefined,
        metadata: { extra: 'info' },
    };

    describe('log()', () => {
        it('should call logger.info with the event and payload spread + timestamp', () => {
            auditLogger.log(basePayload);

            expect(mockWinstonLogger.info).toHaveBeenCalledWith(
                basePayload.event,
                expect.objectContaining({
                    ...basePayload,
                    timestamp: expect.any(String),
                }),
            );
        });

        it('should include a valid ISO timestamp', () => {
            auditLogger.log({ event: 'STOCK_DECREMENTED' });

            const callArgs = mockWinstonLogger.info.mock.calls[0];
            const payload = callArgs[1] as { timestamp: string };
            expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
        });
    });

    describe('error()', () => {
        it('should call logger.error with the event and payload spread + timestamp', () => {
            const errorPayload: AuditPayload = {
                event: 'TRANSACTION_ERROR',
                error: 'Something went wrong',
            };

            auditLogger.error(errorPayload);

            expect(mockWinstonLogger.error).toHaveBeenCalledWith(
                errorPayload.event,
                expect.objectContaining({
                    ...errorPayload,
                    timestamp: expect.any(String),
                }),
            );
        });
    });

    describe('warn()', () => {
        it('should call logger.warn with the event and payload spread + timestamp', () => {
            const warnPayload: AuditPayload = {
                event: 'WEBHOOK_SIGNATURE_INVALID',
                reference: 'ref-2',
            };

            auditLogger.warn(warnPayload);

            expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
                warnPayload.event,
                expect.objectContaining({
                    ...warnPayload,
                    timestamp: expect.any(String),
                }),
            );
        });

        it('should work with minimal payload (only required event field)', () => {
            auditLogger.warn({ event: 'RATE_LIMIT_EXCEEDED' });

            expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
                'RATE_LIMIT_EXCEEDED',
                expect.objectContaining({ event: 'RATE_LIMIT_EXCEEDED' }),
            );
        });
    });
});
