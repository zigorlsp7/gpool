import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PredictionModule } from './prediction/prediction.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PredictionModule, HealthModule],
})
export class AppModule {}
