import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Audit log format includes:
 * - timestamp (ISO)
 * - level
 * - context (class name)
 * - message
 * - metadata (userId, ip, transactionId, etc.)
 *
 * In production: JSON to stdout (picked up by CloudWatch / ECS)
 * In development: colorized human-readable
 */
export const winstonConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: isDev
        ? combine(colorize(), simple())
        : combine(timestamp(), errors({ stack: true }), json()),
    }),
    // Separate audit log file — append-only, never rotated in place
    new winston.transports.File({
      filename: 'logs/audit.log',
      level: 'info',
      format: combine(timestamp(), json()),
      options: { flags: 'a' }, // append-only
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
  ],
};
