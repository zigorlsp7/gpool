import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { NotificationService } from './notification.service';

@Module({
  providers: [EmailService, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
