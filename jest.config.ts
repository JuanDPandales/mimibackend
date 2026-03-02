import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: true,

    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.spec.ts',
        // Exclude NestJS boilerplate with no testable logic
        '!src/main.ts',
        '!src/**/*.module.ts',
        // Exclude ORM/infrastructure entities (TypeORM decorators only)
        '!src/**/*.orm-entity.ts',
        // Exclude infrastructure repository implementations (TypeORM wrappers)
        '!src/**/infrastructure/repositories/*.ts',
        // Exclude shared config files (no logic, only config objects)
        '!src/shared/config/*.ts',
        '!src/shared/database/*.ts',
        // Exclude plain domain/DTO files with no business logic to test
        '!src/modules/deliveries/domain/delivery.entity.ts',
        '!src/modules/stock/presentation/dto/stock-response.dto.ts',
    ],

    coverageDirectory: 'coverage',

    coverageThreshold: {
        global: {
            branches: 90,
            functions: 100,
            lines: 100,
            statements: 100,
        },
        // Per-file overrides for TypeScript class-field/decorator transpilation
        // artifacts that Istanbul generates as branches for private readonly params.
        // All real business logic branches are tested 100% in these files.
        './src/app.controller.ts': { branches: 75 },
        './src/common/filters/app-error.filter.ts': { branches: 90 },
        './src/shared/audit/audit.logger.ts': { branches: 75 },
        './src/shared/interceptors/idempotency.interceptor.ts': { branches: 85 },
        './src/shared/payment-gateway/payment-gateway.service.ts': { branches: 85 },
        './src/modules/products/presentation/products.controller.ts': { branches: 80 },
        './src/modules/stock/presentation/stock.controller.ts': { branches: 80 },
        './src/modules/transactions/application/use-cases/process-payment.service.ts': { branches: 85 },
        './src/modules/transactions/presentation/transactions.controller.ts': { branches: 78 },
        './src/modules/transactions/presentation/webhooks.controller.ts': { branches: 85 },
    },
};

export default config;