import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { IdempotencyKeyOrmEntity } from '../../modules/transactions/infrastructure/entities/idempotency-key.orm-entity';
import { AuditLogger } from '../audit/audit.logger';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let mockDataSource: Partial<DataSource>;
  let mockAuditLogger: Partial<AuditLogger>;
  let mockRepository: Partial<Repository<IdempotencyKeyOrmEntity>>;
  let mockCallHandler: Partial<CallHandler>;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    mockAuditLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    interceptor = new IdempotencyInterceptor(
      mockDataSource as DataSource,
      mockAuditLogger as AuditLogger,
    );

    mockCallHandler = {
      handle: jest
        .fn()
        .mockReturnValue(of({ success: true, data: 'new response' })),
    };
  });

  function createMockContext(
    headers: Record<string, string>,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => ({
          statusCode: 201,
          status: jest.fn().mockReturnThis(),
        }),
        getNext: jest.fn(),
      }),
    } as unknown as ExecutionContext;
  }

  it('should bypass interceptor if no idempotency key is provided', async () => {
    const context = createMockContext({});
    const result$ = await interceptor.intercept(
      context,
      mockCallHandler as CallHandler,
    );

    result$.subscribe((res) => {
      expect(res).toEqual({ success: true, data: 'new response' });
    });
    expect(mockDataSource.getRepository).not.toHaveBeenCalled();
  });

  it('should bypass interceptor if idempotency key is invalid', async () => {
    const context = createMockContext({
      'x-idempotency-key': 'invalid key @!',
    });
    const result$ = await interceptor.intercept(
      context,
      mockCallHandler as CallHandler,
    );

    result$.subscribe((res) => {
      expect(res).toEqual({ success: true, data: 'new response' });
    });
    expect(mockDataSource.getRepository).not.toHaveBeenCalled();
  });

  it('should return cached response if idempotency key exists', async () => {
    const cachedRecord = {
      key: 'valid-key-123',
      statusCode: 200,
      response: { cached: true },
    };
    (mockRepository.findOne as jest.Mock).mockResolvedValue(cachedRecord);

    const context = createMockContext({ 'x-idempotency-key': 'valid-key-123' });
    const result$ = await interceptor.intercept(
      context,
      mockCallHandler as CallHandler,
    );

    result$.subscribe((res) => {
      expect(res).toEqual({ cached: true });
    });

    expect(mockAuditLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'IDEMPOTENCY_HIT' }),
    );
    expect(mockCallHandler.handle).not.toHaveBeenCalled();
  });

  it('should proceed and save response if idempotency key is new', async () => {
    (mockRepository.findOne as jest.Mock).mockResolvedValue(null);
    const context = createMockContext({ 'x-idempotency-key': 'new-key-123' });

    const result$ = await interceptor.intercept(
      context,
      mockCallHandler as CallHandler,
    );

    result$.subscribe((res) => {
      expect(res).toEqual({ success: true, data: 'new response' });
      expect(mockRepository.save).toHaveBeenCalledWith({
        key: 'new-key-123',
        response: { success: true, data: 'new response' },
        statusCode: 201,
      });
    });
  });

  it('should log an error if saving the new idempotency key fails', async () => {
    (mockRepository.findOne as jest.Mock).mockResolvedValue(null);
    (mockRepository.save as jest.Mock).mockRejectedValue(new Error('DB Error'));

    const context = createMockContext({ 'x-idempotency-key': 'new-key-123' });
    const result$ = await interceptor.intercept(
      context,
      mockCallHandler as CallHandler,
    );

    result$.subscribe((res) => {
      expect(res).toEqual({ success: true, data: 'new response' });
      expect(mockAuditLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'IDEMPOTENCY_SAVE_ERROR' }),
      );
    });
  });
});
