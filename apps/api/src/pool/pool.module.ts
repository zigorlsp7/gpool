import { Module } from '@nestjs/common';
import { PoolController } from './pool.controller';
import { PoolService } from './pool.service';
import { MatchModule } from './match/match.module';
import { BracketController } from './bracket/bracket.controller';
import { BracketService } from './bracket/bracket.service';
import { PoolRepository } from './database/pool.repository';
import { NotificationModule } from '../notification/notification.module';

@Module({
  controllers: [PoolController, BracketController],
  providers: [PoolService, BracketService, PoolRepository],
  imports: [MatchModule, NotificationModule],
  exports: [PoolService, PoolRepository],
})
export class PoolModule {}
