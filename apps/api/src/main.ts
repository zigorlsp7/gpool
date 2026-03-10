import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { httpMetricsMiddleware } from './common/metrics/http-metrics.middleware';
import './observability/tracing';

type TrustProxy = boolean | number | 'loopback' | 'linklocal' | 'uniquelocal';

function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw === null || raw.trim() === '') {
    throw new Error('CORS_ORIGINS is required and must not be empty');
  }
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS is required and must contain at least one origin');
  }
  return origins;
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

function parseTrustProxy(input: string | undefined): TrustProxy {
  if (input === undefined || input === null || input.trim() === '') {
    return false;
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  if (
    normalized === 'loopback' ||
    normalized === 'linklocal' ||
    normalized === 'uniquelocal'
  ) {
    return normalized;
  }
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  throw new Error(
    'TRUST_PROXY must be one of: false, true, loopback, linklocal, uniquelocal, or a numeric hop count',
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();

  app.setGlobalPrefix('api', { exclude: ['metrics'] });
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
  }
  app.use(httpMetricsMiddleware);

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
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
