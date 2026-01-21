import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = process.env.PORT || 3004;
  await app.listen(port);
  console.log(`Match service is running on: http://localhost:${port}`);
}
bootstrap();
