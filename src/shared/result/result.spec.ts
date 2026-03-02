import {
  AppError,
  ConflictError,
  err,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ok,
  OutOfStockError,
  PaymentError,
  UnauthorizedError,
  ValidationError,
} from './result';

describe('Result Type Factory Functions', () => {
  describe('ok()', () => {
    it('should create a success result containing the provided value', () => {
      // Arrange
      const mockValue = { id: 1, name: 'Test' };

      // Act
      const result = ok(mockValue);

      // Assert
      expect(result.success).toBe(true);
      // TypeScript narrow assertion
      if (result.success) {
        expect(result.value).toBe(mockValue);
      }
    });
  });

  describe('err()', () => {
    it('should create a failure result containing the provided error', () => {
      // Arrange
      const mockError = new Error('Something went wrong');

      // Act
      const result = err(mockError);

      // Assert
      expect(result.success).toBe(false);
      // TypeScript narrow assertion
      if (!result.success) {
        expect(result.error).toBe(mockError);
      }
    });
  });
});

describe('AppError abstract base class', () => {
  // Arrange: Create a concrete class for testing the abstract AppError
  class ConcreteTestError extends AppError {
    constructor(code: string, message: string, statusCode?: number) {
      super(code, message, statusCode);
    }
  }

  it('should initialize properties correctly when a custom status code is provided', () => {
    // Arrange
    const expectedCode = 'TEST_ERROR';
    const expectedMessage = 'This is a test error';
    const expectedStatusCode = 418; // I'm a teapot

    // Act
    const error = new ConcreteTestError(
      expectedCode,
      expectedMessage,
      expectedStatusCode,
    );

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe(expectedCode);
    expect(error.message).toBe(expectedMessage);
    expect(error.statusCode).toBe(expectedStatusCode);
  });

  it('should use 400 as default statusCode when not explicitly provided', () => {
    // Arrange
    const expectedCode = 'TEST_ERROR_DEFAULT';
    const expectedMessage = 'This is a default test error';

    // Act
    const error = new ConcreteTestError(expectedCode, expectedMessage);

    // Assert
    expect(error.statusCode).toBe(400); // 400 is the default value specified in the AppError abstract class
    expect(error.code).toBe(expectedCode);
    expect(error.message).toBe(expectedMessage);
  });
});

describe('Specific AppError Implementations', () => {
  describe('NotFoundError', () => {
    it('should format message with resource name and set statusCode to 404', () => {
      // Arrange
      const resourceName = 'Product';

      // Act
      const error = new NotFoundError(resourceName);

      // Assert
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe(resourceName);
    });
  });

  describe('OutOfStockError', () => {
    it('should use the default message when no argument is passed', () => {
      // Arrange & Act
      const error = new OutOfStockError();

      // Assert
      expect(error.code).toBe('OUT_OF_STOCK');
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Producto sin stock');
    });

    it('should use the custom message provided', () => {
      // Arrange
      const customMessage =
        'No hay unidades suficientes para completar la orden';

      // Act
      const error = new OutOfStockError(customMessage);

      // Assert
      expect(error.code).toBe('OUT_OF_STOCK');
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe(customMessage);
    });
  });

  describe('PaymentError', () => {
    it('should set statusCode to 402 and store the specific payment message', () => {
      // Arrange
      const reason = 'Insufficient funds';

      // Act
      const error = new PaymentError(reason);

      // Assert
      expect(error.code).toBe('PAYMENT_ERROR');
      expect(error.statusCode).toBe(402);
      expect(error.message).toBe(reason);
    });
  });

  describe('ValidationError', () => {
    it('should set statusCode to 400 for standard input validation errors', () => {
      // Arrange
      const reason = 'Invalid email format';

      // Act
      const error = new ValidationError(reason);

      // Assert
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe(reason);
    });
  });

  describe('ConflictError', () => {
    it('should format message indicating the resource already exists and set statusCode to 409', () => {
      // Arrange
      const resource = 'UserEmail';

      // Act
      const error = new ConflictError(resource);

      // Assert
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('UserEmail ya existe');
    });
  });

  describe('UnauthorizedError', () => {
    it('should set statusCode to 401 for authentication failures', () => {
      // Arrange
      const reason = 'Token expired';

      // Act
      const error = new UnauthorizedError(reason);

      // Assert
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe(reason);
    });
  });

  describe('ForbiddenError', () => {
    it('should set statusCode to 403 for authorization/roles failures', () => {
      // Arrange
      const reason = 'Insufficient permissions to execute this action';

      // Act
      const error = new ForbiddenError(reason);

      // Assert
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe(reason);
    });
  });

  describe('InternalServerError', () => {
    it('should set statusCode to 500 for unhandled native / unexpected errors', () => {
      // Arrange
      const reason = 'Database connection lost';

      // Act
      const error = new InternalServerError(reason);

      // Assert
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe(reason);
    });
  });
});
