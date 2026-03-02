import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../../shared/result/result';
import { AuditLogger } from '../../shared/audit/audit.logger';

@Catch()
export class AppErrorFilter implements ExceptionFilter {
    constructor(private readonly auditLogger?: AuditLogger) { }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        if (exception instanceof AppError) {
            return response.status(exception.statusCode).json({
                success: false,
                error: {
                    code: exception.code,
                    message: exception.message,
                },
            });
        }

        if (exception instanceof HttpException) {
            const httpException = exception as HttpException;
            const status = httpException.getStatus();
            const res = httpException.getResponse() as Record<string, any>;

            // Standard NestJS validation pipe error or other HttpException
            return response.status(status).json({
                success: false,
                error: {
                    code: status === 400 ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
                    message: res.message || exception.message,
                },
            });
        }

        // Unhandled exceptions (Log to audit/Winston and sanitize output)
        if (this.auditLogger) {
            this.auditLogger.error({
                event: 'TRANSACTION_ERROR', // General fallback event mapping
                error: exception instanceof Error ? exception.message : 'Unknown error',
                metadata: {
                    stack: process.env.NODE_ENV !== 'production' && exception instanceof Error ? exception.stack : undefined
                }
            });
        } else {
            console.error(exception);
        }

        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
            },
        });
    }
}
