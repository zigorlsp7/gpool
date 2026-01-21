import { Injectable } from '@nestjs/common';

@Injectable()
export class PredictionService {
  async findAll() {
    return { message: 'Prediction service - to be implemented' };
  }
}
