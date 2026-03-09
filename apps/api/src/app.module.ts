import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { PoolModule } from './pool/pool.module';
import { RUMModule } from './rum/rum.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    PoolModule,
    RUMModule,
  ],
})
export class AppModule {}
