import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PoolRepository } from '../database/pool.repository';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(private readonly poolRepository: PoolRepository) {}

  async getTeamsByGroup(group: string) {
    return this.poolRepository.getTeamsByGroup(group);
  }

  async getAllTeams() {
    return this.poolRepository.getAllTeams();
  }

  async getMatchesByPool(poolId: string) {
    const allMatches = await this.poolRepository.getMatchesByPool('all-pools');

    const matchesByGroup: Record<string, any[]> = {};
    for (const match of allMatches) {
      const groupId = match.groupId || 'Unknown';
      if (!matchesByGroup[groupId]) {
        matchesByGroup[groupId] = [];
      }
      matchesByGroup[groupId].push(match);
    }

    return {
      matches: allMatches,
      matchesByGroup,
      groups: Object.keys(matchesByGroup).sort(),
      poolId,
    };
  }

  async getMatch(matchId: string) {
    const match = await this.poolRepository.getMatch(matchId);
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }
    return match;
  }

  async submitPrediction(
    poolId: string,
    matchId: string,
    userId: string,
    homeScore: number,
    awayScore: number,
  ) {
    const match = await this.poolRepository.getMatch(matchId);
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const now = Date.now();
    if (match.deadline && now >= match.deadline) {
      throw new BadRequestException('Prediction deadline has passed');
    }

    if (homeScore < 0 || awayScore < 0 || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      throw new BadRequestException('Scores must be non-negative integers');
    }

    const prediction = await this.poolRepository.createPrediction(
      poolId,
      matchId,
      userId,
      homeScore,
      awayScore,
    );

    this.logger.log(`Prediction submitted: pool ${poolId}, match ${matchId}, user ${userId}`);
    return prediction;
  }

  async getUserPredictions(poolId: string, userId: string) {
    return this.poolRepository.getUserPredictions(poolId, userId);
  }

  async getPrediction(poolId: string, matchId: string, userId: string) {
    return this.poolRepository.getPrediction(poolId, matchId, userId);
  }

  async updateMatchResults(
    matchId: string,
    homeResult: number,
    awayResult: number,
    poolId?: string,
    scoringConfig?: { winnerPoints: number; exactResultPoints: number },
  ) {
    const match = await this.poolRepository.getMatch(matchId);
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    if (
      homeResult < 0 ||
      awayResult < 0 ||
      !Number.isInteger(homeResult) ||
      !Number.isInteger(awayResult)
    ) {
      throw new BadRequestException('Results must be non-negative integers');
    }

    await this.poolRepository.updateMatchResults(matchId, homeResult, awayResult);

    const allPredictions = await this.poolRepository.getAllPredictionsForMatch(matchId);

    let winnerPoints = 1;
    let exactResultPoints = 3;

    if (poolId) {
      const pool = await this.poolRepository.getPool(poolId);
      if (pool?.config?.scoring) {
        winnerPoints = pool.config.scoring.winnerPoints ?? winnerPoints;
        exactResultPoints = pool.config.scoring.exactResultPoints ?? exactResultPoints;
      }
    }

    if (scoringConfig) {
      winnerPoints = scoringConfig.winnerPoints ?? winnerPoints;
      exactResultPoints = scoringConfig.exactResultPoints ?? exactResultPoints;
    }

    const getOutcome = (home: number, away: number): 'home' | 'away' | 'draw' => {
      if (home > away) return 'home';
      if (away > home) return 'away';
      return 'draw';
    };

    for (const prediction of allPredictions) {
      const exactMatch = prediction.homeScore === homeResult && prediction.awayScore === awayResult;
      const predictedOutcome = getOutcome(prediction.homeScore, prediction.awayScore);
      const actualOutcome = getOutcome(homeResult, awayResult);
      const winnerMatch = !exactMatch && predictedOutcome === actualOutcome;

      let points = 0;
      if (exactMatch) {
        points = exactResultPoints;
      } else if (winnerMatch) {
        points = winnerPoints;
      }

      await this.poolRepository.updatePredictionStatus(
        prediction.predictionId,
        exactMatch || winnerMatch,
        points,
        exactMatch,
      );
    }

    this.logger.log(
      `Match results updated and ${allPredictions.length} predictions evaluated for match ${matchId}`,
    );

    return {
      matchId,
      homeResult,
      awayResult,
      predictionsEvaluated: allPredictions.length,
    };
  }

  async getPoolRanking(poolId: string) {
    const allPredictions = await this.poolRepository.getAllPredictionsForPool(poolId);
    const bracketPredictions = await this.poolRepository.getAllBracketPredictionsForPool(poolId);
    const members = await this.poolRepository.getPoolMembers(poolId);

    const memberUserIds = new Set(members.map((member: any) => member.userId));

    const userPoints = new Map<string, { points: number; userName: string; userEmail?: string }>();
    members.forEach((member: any) => {
      const email = member.userEmail || '';
      const userName = member.userName || (email ? email.split('@')[0] : `User ${member.userId.slice(0, 8)}`);
      userPoints.set(member.userId, {
        points: 0,
        userName,
        userEmail: email,
      });
    });

    allPredictions.forEach((prediction: any) => {
      if (!memberUserIds.has(prediction.userId)) {
        return;
      }
      const current = userPoints.get(prediction.userId);
      if (current) {
        current.points += prediction.points || 0;
      }
    });

    bracketPredictions.forEach((prediction: any) => {
      if (!memberUserIds.has(prediction.userId)) {
        return;
      }
      const current = userPoints.get(prediction.userId);
      if (current) {
        current.points += prediction.points || 0;
      }
    });

    return Array.from(userPoints.values())
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({
        rank: index + 1,
        userName: entry.userName,
        userEmail: entry.userEmail,
        points: entry.points,
      }));
  }
}
