import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RUMService } from './rum.service';

interface RUMEvent {
  type: 'performance' | 'error' | 'interaction' | 'navigation';
  name: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
}

interface RUMEventsDto {
  events: RUMEvent[];
}

@ApiTags('rum')
@Controller('rum')
export class RUMController {
  private readonly logger = new Logger(RUMController.name);

  constructor(private readonly rumService: RUMService) {}

  @Post('events')
  @ApiOperation({ summary: 'Receive RUM events from frontend' })
  @ApiResponse({ status: 200, description: 'Events received successfully' })
  async receiveEvents(@Body() dto: RUMEventsDto) {
    this.logger.log(`Received ${dto.events.length} RUM events`);
    
    // Process events asynchronously (non-blocking)
    this.rumService.processEvents(dto.events).catch((err) => {
      this.logger.error('Failed to process RUM events', err);
    });

    return { success: true, received: dto.events.length };
  }
}
