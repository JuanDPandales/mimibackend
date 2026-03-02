export type Result<T, E = AppError> =
  | { success: true; value: T }
  | { success: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ success: true, value });
export const err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});

export abstract class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource}`, 404);
  }
}

export class OutOfStockError extends AppError {
  constructor(message: string = 'Producto sin stock') {
    super('OUT_OF_STOCK', message, 422);
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super('PAYMENT_ERROR', message, 402);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(resource: string) {
    super('CONFLICT', `${resource} ya existe`, 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('FORBIDDEN', message, 403);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string) {
    super('INTERNAL_SERVER_ERROR', message, 500);
  }
}
