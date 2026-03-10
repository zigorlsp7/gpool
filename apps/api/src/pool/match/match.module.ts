import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { PoolRepository } from '../database/pool.repository';

@Module({
  controllers: [MatchController],
  providers: [MatchService, PoolRepository],
  exports: [MatchService],
})
export class MatchModule {}
