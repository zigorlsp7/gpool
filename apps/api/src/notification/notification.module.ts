import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationPublisherService } from './notification.publisher.service';

@Module({
  providers: [NotificationPublisherService, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
