import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { Registry } from 'prom-client';
import { registry } from './metrics.registry';

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: Registry,
      useValue: registry,
    },
  ],
  exports: [Registry],
})
export class MetricsModule {}
