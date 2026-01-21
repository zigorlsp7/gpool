import { Controller, Get } from '@nestjs/common';
import { WebsocketService } from './websocket.service';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketService: WebsocketService) {}

  @Get()
  async findAll() {
    return this.websocketService.findAll();
  }
}
