import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PostgresService } from '../database/postgres.service';

@Controller('health')
export class HealthController {
  constructor(private readonly postgres: PostgresService) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'api' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.postgres.ping();
      return { status: 'ok', service: 'api', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'api',
        db: 'down',
      });
    }
  }

  @Get()
  check() {
    return this.ready();
  }
}
