import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppErrorFilter } from './common/filters/app-error.filter';
import { AuditLogger } from './shared/audit/audit.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Requerido para verificación de firma de webhook
  });

  // Seguridad OWASP
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Prefijo global
  app.setGlobalPrefix('api');

  // Validación estricta global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filtro de Errores Custom
  const auditLogger = app.get(AuditLogger);
  app.useGlobalFilters(new AppErrorFilter(auditLogger));

  const port = process.env.PORT || 4000;
  console.log(`[Main] Ready to listen on port: ${port}`);
  await app.listen(port);
  console.log(`[Main] Nest application successfully started on port: ${port}`);
}
bootstrap().catch((err) => {
  console.error('Error starting application', err);
  process.exit(1);
});
