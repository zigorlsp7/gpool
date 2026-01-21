import { Injectable } from '@nestjs/common';

@Injectable()
export class MatchService {
  async findAll() {
    return { message: 'Match service - to be implemented' };
  }
}
