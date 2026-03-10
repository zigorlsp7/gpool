import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PoolRepository } from '../database/pool.repository';

export type BracketPhase = '16th-finals' | '8th-finals' | 'quarter-finals' | 'semi-finals' | 'finals';

@Injectable()
export class BracketService {
  private readonly logger = new Logger(BracketService.name);

  constructor(private readonly poolRepository: PoolRepository) {}

  async getBracketMatches(poolId: string, phase?: BracketPhase) {
    return this.poolRepository.getBracketMatches(poolId, phase);
  }

  async createBracketPhase(
    poolId: string,
    phase: BracketPhase,
    numberOfMatches: number,
    forceRecreate: boolean = false,
  ) {
    const existingMatches = await this.poolRepository.getBracketMatches(poolId, phase);
    if (existingMatches.length > 0) {
      if (!forceRecreate) {
        throw new BadRequestException(`Phase ${phase} already exists for this pool`);
      }
      for (const match of existingMatches) {
        await this.poolRepository.deleteBracketMatch(match.bracketMatchId);
      }
    }

    const allExistingMatches = await this.poolRepository.getBracketMatches(poolId);
    const maxMatchNumber =
      allExistingMatches.length > 0
        ? Math.max(...allExistingMatches.map((match: any) => match.matchNumber || 0))
        : 0;
    const startMatchNumber = maxMatchNumber + 1;

    const phaseOrder: BracketPhase[] = [
      '16th-finals',
      '8th-finals',
      'quarter-finals',
      'semi-finals',
      'finals',
    ];
    const expectedMatchCounts: Record<BracketPhase, number> = {
      '16th-finals': 16,
      '8th-finals': 8,
      'quarter-finals': 4,
      'semi-finals': 2,
      finals: 1,
    };

    let expectedStartNumber = 1;
    for (const currentPhase of phaseOrder) {
      if (currentPhase === phase) {
        break;
      }
      expectedStartNumber += expectedMatchCounts[currentPhase];
    }

    const actualStartNumber = Math.max(startMatchNumber, expectedStartNumber);

    const matches = [];
    for (let index = 0; index < numberOfMatches; index++) {
      const matchNumber = actualStartNumber + index;
      const bracketMatchId = `${poolId}-${phase}-${index + 1}`;
      const match = await this.poolRepository.createBracketMatch({
        bracketMatchId,
        poolId,
        phase,
        matchNumber,
        status: 'scheduled',
      });
      matches.push(match);
    }

    this.logger.log(
      `Created ${numberOfMatches} matches for phase ${phase} in pool ${poolId} starting at match number ${actualStartNumber}`,
    );
    return matches;
  }

  async updateBracketMatchTeam(
    bracketMatchId: string,
    poolId: string,
    side: 'home' | 'away',
    teamId: string,
    teamName: string,
  ) {
    const matches = await this.poolRepository.getBracketMatches(poolId);
    const foundMatch = matches.find((match: any) => match.bracketMatchId === bracketMatchId);

    if (!foundMatch) {
      throw new NotFoundException(`Bracket match ${bracketMatchId} not found`);
    }

    const updates: any = {};
    if (side === 'home') {
      updates.homeTeamId = teamId;
      updates.homeTeamName = teamName;
    } else {
      updates.awayTeamId = teamId;
      updates.awayTeamName = teamName;
    }

    const updatedMatch = await this.poolRepository.updateBracketMatch(bracketMatchId, updates);
    const allMatches = await this.poolRepository.getBracketMatches(poolId);
    const fullMatch = allMatches.find((match: any) => match.bracketMatchId === bracketMatchId);

    if (fullMatch?.homeTeamId && fullMatch?.awayTeamId) {
      await this.evaluateBracketPredictions(bracketMatchId, fullMatch, poolId);
    }

    return fullMatch || updatedMatch;
  }

  private async evaluateBracketPredictions(
    bracketMatchId: string,
    match: any,
    poolId: string,
    scoringOverride?: { exactPositionPoints?: number; correctTeamWrongPositionPoints?: number },
  ) {
    const pool = await this.poolRepository.getPool(poolId);
    const exactPosPoints =
      scoringOverride?.exactPositionPoints ??
      pool?.config?.bracketScoring?.exactPositionPoints ??
      5;
    const wrongPosPoints =
      scoringOverride?.correctTeamWrongPositionPoints ??
      pool?.config?.bracketScoring?.correctTeamWrongPositionPoints ??
      3;

    const predictions = await this.poolRepository.getAllBracketPredictionsForMatch(bracketMatchId);

    for (const prediction of predictions) {
      let points = 0;

      const homeTeamExactPosition = prediction.homeTeamId === match.homeTeamId;
      const homeTeamCorrectButWrongPosition = prediction.homeTeamId === match.awayTeamId;
      const awayTeamExactPosition = prediction.awayTeamId === match.awayTeamId;
      const awayTeamCorrectButWrongPosition = prediction.awayTeamId === match.homeTeamId;

      if (homeTeamExactPosition) {
        points += exactPosPoints;
      } else if (homeTeamCorrectButWrongPosition) {
        points += wrongPosPoints;
      }

      if (awayTeamExactPosition) {
        points += exactPosPoints;
      } else if (awayTeamCorrectButWrongPosition) {
        points += wrongPosPoints;
      }

      await this.poolRepository.updateBracketPredictionPoints(
        prediction.bracketPredictionId,
        points,
        homeTeamExactPosition,
        awayTeamExactPosition,
        homeTeamCorrectButWrongPosition,
        awayTeamCorrectButWrongPosition,
      );
    }
  }

  async updateBracketMatchResult(
    bracketMatchId: string,
    poolId: string,
    homeResult: number,
    awayResult: number,
    exactPositionPoints?: number,
    correctTeamWrongPositionPoints?: number,
  ) {
    const matches = await this.poolRepository.getBracketMatches(poolId);
    const foundMatch = matches.find((match: any) => match.bracketMatchId === bracketMatchId);
    if (!foundMatch) {
      throw new NotFoundException(`Bracket match ${bracketMatchId} not found`);
    }

    const updatedMatch = await this.poolRepository.updateBracketMatch(bracketMatchId, {
      homeResult,
      awayResult,
      status: 'completed',
    });

    if (updatedMatch?.homeTeamId && updatedMatch?.awayTeamId) {
      await this.evaluateBracketPredictions(bracketMatchId, updatedMatch, poolId, {
        exactPositionPoints,
        correctTeamWrongPositionPoints,
      });
    }

    const predictions = await this.poolRepository.getAllBracketPredictionsForMatch(bracketMatchId);
    return {
      bracketMatchId,
      homeResult,
      awayResult,
      predictionsEvaluated: predictions.length,
    };
  }

  async getBracketStructure(poolId: string) {
    const allMatches = await this.poolRepository.getBracketMatches(poolId);
    const phases: BracketPhase[] = ['16th-finals', '8th-finals', 'quarter-finals', 'semi-finals', 'finals'];

    const structure: Record<string, any[]> = {};
    for (const phase of phases) {
      structure[phase] = allMatches
        .filter((match: any) => match.phase === phase)
        .sort((a: any, b: any) => a.matchNumber - b.matchNumber);
    }

    return structure;
  }

  async createBracketPrediction(
    poolId: string,
    bracketMatchId: string,
    userId: string,
    homeTeamId: string,
    homeTeamName: string,
    awayTeamId: string,
    awayTeamName: string,
  ) {
    const deadline = new Date('2026-06-08T00:00:00Z').getTime();
    if (Date.now() >= deadline) {
      throw new BadRequestException('Deadline has passed. Bracket predictions can no longer be edited.');
    }

    return this.poolRepository.createBracketPrediction(
      poolId,
      bracketMatchId,
      userId,
      homeTeamId,
      homeTeamName,
      awayTeamId,
      awayTeamName,
    );
  }

  async getUserBracketPredictions(poolId: string, userId: string) {
    return this.poolRepository.getUserBracketPredictions(poolId, userId);
  }

  async getBracketPrediction(poolId: string, bracketMatchId: string, userId: string) {
    return this.poolRepository.getBracketPrediction(poolId, bracketMatchId, userId);
  }

  async reEvaluateAllBracketMatches(poolId: string) {
    const allMatches = await this.poolRepository.getBracketMatches(poolId);
    const matchesToEvaluate = allMatches.filter((match: any) => match.homeTeamId && match.awayTeamId);

    for (const match of matchesToEvaluate) {
      await this.evaluateBracketPredictions(match.bracketMatchId, match, poolId);
    }

    return { matchesEvaluated: matchesToEvaluate.length };
  }
}
