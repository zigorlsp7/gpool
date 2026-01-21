import { Injectable } from '@nestjs/common';

@Injectable()
export class WebsocketService {
  async findAll() {
    return { message: 'WebSocket service - to be implemented' };
  }
}
