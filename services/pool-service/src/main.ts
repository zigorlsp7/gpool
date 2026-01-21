import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`Pool service is running on: http://localhost:${port}`);
}
bootstrap();
