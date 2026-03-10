import { Module } from '@nestjs/common';
import { RUMController } from './rum.controller';
import { RUMService } from './rum.service';
import { MetricsModule } from '../common/metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [RUMController],
  providers: [RUMService],
})
export class RUMModule {}
