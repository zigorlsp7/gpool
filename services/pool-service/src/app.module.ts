import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PoolModule } from './pool/pool.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PoolModule, HealthModule],
})
export class AppModule {}
