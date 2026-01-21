import { Injectable } from '@nestjs/common';

@Injectable()
export class LeaderboardService {
  async findAll() {
    return { message: 'Leaderboard service - to be implemented' };
  }
}
