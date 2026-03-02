import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      limit: 60,
      ttl: 60000, // 1 min (V6 NestJs Throttler format, ttl is milliseconds mostly unless seconds configured explicitly string)
    },
    {
      name: 'payment',
      limit: 5,
      ttl: 60000,
    },
    {
      name: 'read',
      limit: 120,
      ttl: 60000,
    },
  ],
};
