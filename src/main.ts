import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
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
  await app.listen(port);
  console.log(`Aplicación ejecutándose en el puerto: ${port}`);
}
bootstrap();
