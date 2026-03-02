import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AuditLogger } from '../../shared/audit/audit.logger';
import { AppError, NotFoundError, InternalServerError } from '../../shared/result/result';
import { AppErrorFilter } from './app-error.filter';

function createMockHost(responseMock: Record<string, jest.Mock>): ArgumentsHost {
    return {
        switchToHttp: () => ({
            getResponse: () => responseMock,
            getRequest: () => ({}),
        }),
    } as unknown as ArgumentsHost;
}

describe('AppErrorFilter', () => {
    let mockResponse: { status: jest.Mock; json: jest.Mock };
    let mockHost: ArgumentsHost;

    beforeEach(() => {
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockHost = createMockHost(mockResponse);
    });

    describe('when exception is an AppError', () => {
        it('should return the AppError status code and error payload', () => {
            const filter = new AppErrorFilter();
            const error = new NotFoundError('Product');

            filter.catch(error, mockHost);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: error.message,
                },
            });
        });

        it('should return 500 for InternalServerError', () => {
            const filter = new AppErrorFilter();
            const error = new InternalServerError('Something went wrong');

            filter.catch(error, mockHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }),
                }),
            );
        });
    });

    describe('when exception is an HttpException', () => {
        it('should return 400 with VALIDATION_ERROR code for status 400', () => {
            const filter = new AppErrorFilter();
            const exception = new HttpException({ message: 'Bad input' }, 400);

            filter.catch(exception, mockHost);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
                }),
            );
        });

        it('should join array messages from HttpException response', () => {
            const filter = new AppErrorFilter();
            const exception = new HttpException(
                { message: ['must not be empty', 'must be a string'] },
                400,
            );

            filter.catch(exception, mockHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        message: 'must not be empty, must be a string',
                    }),
                }),
            );
        });

        it('should use HTTP_ERROR code for non-400 HttpExceptions', () => {
            const filter = new AppErrorFilter();
            const exception = new HttpException('Forbidden', 403);

            filter.catch(exception, mockHost);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({ code: 'HTTP_ERROR' }),
                }),
            );
        });

        it('should use exception.message when res is a plain string', () => {
            const filter = new AppErrorFilter();
            // HttpException where getResponse() returns a string
            const exception = new HttpException('Unauthorized access', 401);

            filter.catch(exception, mockHost);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        message: expect.any(String),
                    }),
                }),
            );
        });

        it('should fall back to exception.message when res.message is falsy', () => {
            const filter = new AppErrorFilter();
            // Create HttpException with object but no message
            const exception = new HttpException({ statusCode: 400 }, 400);

            filter.catch(exception, mockHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false }),
            );
        });
    });

    describe('when exception is unknown (generic Error)', () => {
        it('should call auditLogger.error when auditLogger is provided', () => {
            const mockAuditLogger = { error: jest.fn() };
            const filter = new AppErrorFilter(mockAuditLogger as unknown as AuditLogger);
            const error = new Error('Unexpected failure');

            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            filter.catch(error, mockHost);

            process.env.NODE_ENV = originalEnv;

            expect(mockAuditLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'TRANSACTION_ERROR',
                    error: 'Unexpected failure',
                }),
            );
            expect(mockResponse.status).toHaveBeenCalledWith(
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred',
                },
            });
        });

        it('should include stack trace in development but not in production', () => {
            const mockAuditLogger = { error: jest.fn() };
            const filter = new AppErrorFilter(mockAuditLogger as unknown as AuditLogger);
            const error = new Error('Unexpected failure');

            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            filter.catch(error, mockHost);

            process.env.NODE_ENV = originalEnv;

            expect(mockAuditLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { stack: undefined },
                }),
            );
        });

        it('should pass non-Error exception as "Unknown error" to auditLogger', () => {
            const mockAuditLogger = { error: jest.fn() };
            const filter = new AppErrorFilter(mockAuditLogger as unknown as AuditLogger);

            filter.catch('some string error', mockHost);

            expect(mockAuditLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Unknown error',
                    metadata: { stack: undefined },
                }),
            );
        });

        it('should use console.error when no auditLogger is provided', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            const filter = new AppErrorFilter();
            const error = new Error('Unexpected failure');

            filter.catch(error, mockHost);

            expect(consoleSpy).toHaveBeenCalledWith(error);
            consoleSpy.mockRestore();
        });
    });
});
