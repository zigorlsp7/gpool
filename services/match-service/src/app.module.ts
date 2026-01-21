import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatchModule } from './match/match.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MatchModule, HealthModule],
})
export class AppModule {}
