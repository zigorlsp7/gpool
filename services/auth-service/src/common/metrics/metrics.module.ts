import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { Registry, collectDefaultMetrics } from 'prom-client';

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: Registry,
      useFactory: () => {
        const registry = new Registry();
        collectDefaultMetrics({ register: registry });
        return registry;
      },
    },
  ],
  exports: [Registry],
})
export class MetricsModule {}
