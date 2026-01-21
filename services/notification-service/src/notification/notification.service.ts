import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async findAll() {
    return { message: 'Notification service - to be implemented' };
  }
}
