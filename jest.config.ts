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
    ],

    coverageDirectory: 'coverage',

    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
};

export default config;