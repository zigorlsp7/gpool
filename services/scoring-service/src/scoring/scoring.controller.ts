import { Controller, Get } from '@nestjs/common';
import { ScoringService } from './scoring.service';

@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get()
  async findAll() {
    return this.scoringService.findAll();
  }
}
