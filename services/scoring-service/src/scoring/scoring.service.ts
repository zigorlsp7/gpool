import { Injectable } from '@nestjs/common';

@Injectable()
export class ScoringService {
  async findAll() {
    return { message: 'Scoring service - to be implemented' };
  }
}
