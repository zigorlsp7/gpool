import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { httpMetricsMiddleware } from './common/metrics/http-metrics.middleware';
import './observability/tracing';

function parseCorsOrigins(raw: string | undefined): string[] | boolean {
  if (!raw) {
    return true;
  }
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

function parseBooleanEnv(input: string | undefined, fallback: boolean): boolean {
  if (input === undefined || input === null || input.trim() === '') {
    return fallback;
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  throw new Error('SWAGGER_ENABLED must be true/false (or 1/0, yes/no)');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', { exclude: ['metrics'] });
  app.use(httpMetricsMiddleware);

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS || process.env.FRONTEND_URL),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const swaggerEnabled = parseBooleanEnv(process.env.SWAGGER_ENABLED, false);
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('GPool API')
      .setDescription('Monolithic backend API for gpool')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT || '3000');
  await app.listen(port);

  console.log(`gpool api listening on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs: http://localhost:${port}/docs`);
  }
}

bootstrap();
