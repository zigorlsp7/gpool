import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';

@Injectable()
export class PoolRepository {
  private readonly logger = new Logger(PoolRepository.name);

  constructor(private readonly postgres: PostgresService) {}

  async createPool(poolData: {
    poolId: string;
    adminUserId: string;
    adminName?: string;
    adminEmail?: string;
    name: string;
    description?: string;
    config?: Record<string, any>;
    createdAt?: number;
    updatedAt?: string;
  }) {
    const result = await this.postgres.query(
      `
        INSERT INTO pools (
          pool_id,
          admin_user_id,
          admin_name,
          admin_email,
          name,
          description,
          config,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, COALESCE($9::timestamptz, NOW()))
        RETURNING
          pool_id AS "poolId",
          admin_user_id AS "adminUserId",
          admin_name AS "adminName",
          admin_email AS "adminEmail",
          name,
          description,
          config,
          created_at::int AS "createdAt",
          updated_at::text AS "updatedAt"
      `,
      [
        poolData.poolId,
        poolData.adminUserId,
        poolData.adminName || '',
        poolData.adminEmail || '',
        poolData.name,
        poolData.description || '',
        JSON.stringify(poolData.config || {}),
        poolData.createdAt || Math.floor(Date.now() / 1000),
        poolData.updatedAt || null,
      ],
    );

    return result.rows[0];
  }

  async getPool(poolId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          pool_id AS "poolId",
          admin_user_id AS "adminUserId",
          admin_name AS "adminName",
          admin_email AS "adminEmail",
          name,
          description,
          config,
          created_at::int AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM pools
        WHERE pool_id = $1
      `,
      [poolId],
    );

    return result.rows[0] || null;
  }

  async updatePool(poolId: string, updates: Record<string, any>) {
    const current = await this.getPool(poolId);
    if (!current) {
      throw new Error(`Pool ${poolId} not found`);
    }

    const result = await this.postgres.query(
      `
        UPDATE pools
        SET
          name = $2,
          description = $3,
          config = $4::jsonb,
          updated_at = NOW()
        WHERE pool_id = $1
        RETURNING
          pool_id AS "poolId",
          admin_user_id AS "adminUserId",
          admin_name AS "adminName",
          admin_email AS "adminEmail",
          name,
          description,
          config,
          created_at::int AS "createdAt",
          updated_at::text AS "updatedAt"
      `,
      [
        poolId,
        updates.name ?? current.name,
        updates.description ?? current.description,
        JSON.stringify(updates.config ?? current.config ?? {}),
      ],
    );

    return result.rows[0];
  }

  async deletePool(poolId: string) {
    await this.postgres.query(`DELETE FROM pools WHERE pool_id = $1`, [poolId]);
    return { success: true };
  }

  async listPools(filters?: { adminUserId?: string }) {
    if (filters?.adminUserId) {
      const result = await this.postgres.query(
        `
          SELECT
            pool_id AS "poolId",
            admin_user_id AS "adminUserId",
            admin_name AS "adminName",
            admin_email AS "adminEmail",
            name,
            description,
            config,
            created_at::int AS "createdAt",
            updated_at::text AS "updatedAt"
          FROM pools
          WHERE admin_user_id = $1
          ORDER BY created_at DESC
        `,
        [filters.adminUserId],
      );
      return result.rows;
    }

    const result = await this.postgres.query(
      `
        SELECT
          pool_id AS "poolId",
          admin_user_id AS "adminUserId",
          admin_name AS "adminName",
          admin_email AS "adminEmail",
          name,
          description,
          config,
          created_at::int AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM pools
        ORDER BY created_at DESC
      `,
    );
    return result.rows;
  }

  async addMember(poolId: string, userId: string, role: string = 'member', userEmail?: string, userName?: string) {
    const result = await this.postgres.query(
      `
        INSERT INTO pool_memberships (pool_id, user_id, role, status, joined_at, user_email, user_name)
        VALUES ($1, $2, $3, 'active', NOW(), $4, $5)
        ON CONFLICT (pool_id, user_id)
        DO UPDATE SET
          role = EXCLUDED.role,
          status = 'active',
          user_email = EXCLUDED.user_email,
          user_name = EXCLUDED.user_name
        RETURNING
          pool_id AS "poolId",
          user_id AS "userId",
          role,
          status,
          joined_at::text AS "joinedAt",
          user_email AS "userEmail",
          user_name AS "userName"
      `,
      [poolId, userId, role, userEmail || '', userName || ''],
    );

    return result.rows[0];
  }

  async getMembership(poolId: string, userId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          pool_id AS "poolId",
          user_id AS "userId",
          role,
          status,
          joined_at::text AS "joinedAt",
          user_email AS "userEmail",
          user_name AS "userName"
        FROM pool_memberships
        WHERE pool_id = $1 AND user_id = $2
      `,
      [poolId, userId],
    );

    return result.rows[0] || null;
  }

  async getPoolMembers(poolId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          pool_id AS "poolId",
          user_id AS "userId",
          role,
          status,
          joined_at::text AS "joinedAt",
          user_email AS "userEmail",
          user_name AS "userName"
        FROM pool_memberships
        WHERE pool_id = $1
        ORDER BY joined_at ASC
      `,
      [poolId],
    );

    return result.rows;
  }

  async getUserPools(userId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          pool_id AS "poolId",
          user_id AS "userId",
          role,
          status,
          joined_at::text AS "joinedAt",
          user_email AS "userEmail",
          user_name AS "userName"
        FROM pool_memberships
        WHERE user_id = $1
        ORDER BY joined_at DESC
      `,
      [userId],
    );

    return result.rows;
  }

  async removeMember(poolId: string, userId: string) {
    await this.postgres.query(
      `DELETE FROM pool_memberships WHERE pool_id = $1 AND user_id = $2`,
      [poolId, userId],
    );
    return { success: true };
  }

  async updateMemberRole(poolId: string, userId: string, role: string) {
    const result = await this.postgres.query(
      `
        UPDATE pool_memberships
        SET role = $3
        WHERE pool_id = $1 AND user_id = $2
        RETURNING
          pool_id AS "poolId",
          user_id AS "userId",
          role,
          status,
          joined_at::text AS "joinedAt",
          user_email AS "userEmail",
          user_name AS "userName"
      `,
      [poolId, userId, role],
    );

    return result.rows[0] || null;
  }

  async getUser(userId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          user_id AS "userId",
          email,
          name,
          picture,
          role,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM users
        WHERE user_id = $1
      `,
      [userId],
    );

    return result.rows[0] || null;
  }

  async getTeam(teamId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          team_id AS "teamId",
          name,
          group_id AS "group",
          code
        FROM teams
        WHERE team_id = $1
      `,
      [teamId],
    );

    return result.rows[0] || null;
  }

  async getTeamsByGroup(group: string) {
    const result = await this.postgres.query(
      `
        SELECT
          team_id AS "teamId",
          name,
          group_id AS "group",
          code
        FROM teams
        WHERE group_id = $1
        ORDER BY name ASC
      `,
      [group],
    );

    return result.rows;
  }

  async getAllTeams() {
    const result = await this.postgres.query(
      `
        SELECT
          team_id AS "teamId",
          name,
          group_id AS "group",
          code
        FROM teams
        ORDER BY group_id ASC, name ASC
      `,
    );

    return result.rows;
  }

  async getMatch(matchId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          match_id AS "matchId",
          pool_id AS "poolId",
          group_id AS "groupId",
          home_team_id AS "homeTeamId",
          away_team_id AS "awayTeamId",
          home_team_name AS "homeTeamName",
          away_team_name AS "awayTeamName",
          scheduled_at::text AS "scheduledAt",
          deadline::double precision AS "deadline",
          phase,
          status,
          home_result AS "homeResult",
          away_result AS "awayResult",
          created_at::int AS "createdAt"
        FROM group_phase_matches
        WHERE match_id = $1
      `,
      [matchId],
    );

    return result.rows[0] || null;
  }

  async getMatchesByPool(poolId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          match_id AS "matchId",
          pool_id AS "poolId",
          group_id AS "groupId",
          home_team_id AS "homeTeamId",
          away_team_id AS "awayTeamId",
          home_team_name AS "homeTeamName",
          away_team_name AS "awayTeamName",
          scheduled_at::text AS "scheduledAt",
          deadline::double precision AS "deadline",
          phase,
          status,
          home_result AS "homeResult",
          away_result AS "awayResult",
          created_at::int AS "createdAt"
        FROM group_phase_matches
        WHERE pool_id = $1
        ORDER BY group_id ASC, match_id ASC
      `,
      [poolId],
    );

    return result.rows;
  }

  async getMatchesByPoolAndGroup(poolId: string, groupId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          match_id AS "matchId",
          pool_id AS "poolId",
          group_id AS "groupId",
          home_team_id AS "homeTeamId",
          away_team_id AS "awayTeamId",
          home_team_name AS "homeTeamName",
          away_team_name AS "awayTeamName",
          scheduled_at::text AS "scheduledAt",
          deadline::double precision AS "deadline",
          phase,
          status,
          home_result AS "homeResult",
          away_result AS "awayResult",
          created_at::int AS "createdAt"
        FROM group_phase_matches
        WHERE pool_id = $1 AND group_id = $2
        ORDER BY match_id ASC
      `,
      [poolId, groupId],
    );

    return result.rows;
  }

  async createPrediction(poolId: string, matchId: string, userId: string, homeScore: number, awayScore: number) {
    const predictionId = `${poolId}-${matchId}-${userId}`;
    const now = Math.floor(Date.now() / 1000);

    const result = await this.postgres.query(
      `
        INSERT INTO group_phase_predictions (
          prediction_id,
          pool_id,
          match_id,
          user_id,
          home_score,
          away_score,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (prediction_id)
        DO UPDATE SET
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          updated_at = EXCLUDED.updated_at
        RETURNING
          prediction_id AS "predictionId",
          pool_id AS "poolId",
          match_id AS "matchId",
          user_id AS "userId",
          home_score AS "homeScore",
          away_score AS "awayScore",
          is_correct AS "isCorrect",
          is_exact_match AS "isExactMatch",
          points::int AS "points",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
      `,
      [predictionId, poolId, matchId, userId, homeScore, awayScore, now],
    );

    return result.rows[0];
  }

  async getPrediction(poolId: string, matchId: string, userId: string) {
    const predictionId = `${poolId}-${matchId}-${userId}`;

    const result = await this.postgres.query(
      `
        SELECT
          prediction_id AS "predictionId",
          pool_id AS "poolId",
          match_id AS "matchId",
          user_id AS "userId",
          home_score AS "homeScore",
          away_score AS "awayScore",
          is_correct AS "isCorrect",
          is_exact_match AS "isExactMatch",
          points::int AS "points",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM group_phase_predictions
        WHERE prediction_id = $1
      `,
      [predictionId],
    );

    return result.rows[0] || null;
  }

  async getUserPredictions(poolId: string, userId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          prediction_id AS "predictionId",
          pool_id AS "poolId",
          match_id AS "matchId",
          user_id AS "userId",
          home_score AS "homeScore",
          away_score AS "awayScore",
          is_correct AS "isCorrect",
          is_exact_match AS "isExactMatch",
          points::int AS "points",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM group_phase_predictions
        WHERE user_id = $1 AND pool_id = $2
        ORDER BY match_id ASC
      `,
      [userId, poolId],
    );

    return result.rows;
  }

  async updateMatchResults(matchId: string, homeResult: number, awayResult: number) {
    await this.postgres.query(
      `
        UPDATE group_phase_matches
        SET home_result = $2, away_result = $3, status = 'completed'
        WHERE match_id = $1
      `,
      [matchId, homeResult, awayResult],
    );

    return { matchId, homeResult, awayResult };
  }

  async getAllPredictionsForMatch(matchId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          prediction_id AS "predictionId",
          pool_id AS "poolId",
          match_id AS "matchId",
          user_id AS "userId",
          home_score AS "homeScore",
          away_score AS "awayScore",
          is_correct AS "isCorrect",
          is_exact_match AS "isExactMatch",
          points::int AS "points",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM group_phase_predictions
        WHERE match_id = $1
      `,
      [matchId],
    );

    return result.rows;
  }

  async updatePredictionStatus(predictionId: string, isCorrect: boolean, points?: number, isExactMatch?: boolean) {
    await this.postgres.query(
      `
        UPDATE group_phase_predictions
        SET
          is_correct = $2,
          points = COALESCE($3, points),
          is_exact_match = COALESCE($4, is_exact_match),
          evaluated_at = $5
        WHERE prediction_id = $1
      `,
      [predictionId, isCorrect, points ?? null, isExactMatch ?? null, Math.floor(Date.now() / 1000)],
    );
  }

  async getAllPredictionsForPool(poolId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          prediction_id AS "predictionId",
          pool_id AS "poolId",
          match_id AS "matchId",
          user_id AS "userId",
          home_score AS "homeScore",
          away_score AS "awayScore",
          is_correct AS "isCorrect",
          is_exact_match AS "isExactMatch",
          points::int AS "points",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM group_phase_predictions
        WHERE pool_id = $1
      `,
      [poolId],
    );

    return result.rows;
  }

  async createBracketMatch(bracketMatchData: {
    bracketMatchId: string;
    poolId: string;
    phase: string;
    matchNumber: number;
    homeTeamId?: string;
    homeTeamName?: string;
    awayTeamId?: string;
    awayTeamName?: string;
    homeResult?: number;
    awayResult?: number;
    scheduledAt?: string;
    status?: string;
  }) {
    const result = await this.postgres.query(
      `
        INSERT INTO final_phase_matches (
          bracket_match_id,
          pool_id,
          phase,
          match_number,
          home_team_id,
          home_team_name,
          away_team_id,
          away_team_name,
          home_result,
          away_result,
          scheduled_at,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()), $12, $13)
        ON CONFLICT (bracket_match_id)
        DO UPDATE SET
          pool_id = EXCLUDED.pool_id,
          phase = EXCLUDED.phase,
          match_number = EXCLUDED.match_number,
          home_team_id = EXCLUDED.home_team_id,
          home_team_name = EXCLUDED.home_team_name,
          away_team_id = EXCLUDED.away_team_id,
          away_team_name = EXCLUDED.away_team_name,
          home_result = EXCLUDED.home_result,
          away_result = EXCLUDED.away_result,
          scheduled_at = EXCLUDED.scheduled_at,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.created_at
        RETURNING
          bracket_match_id AS "bracketMatchId",
          pool_id AS "poolId",
          phase,
          match_number AS "matchNumber",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          home_result AS "homeResult",
          away_result AS "awayResult",
          scheduled_at::text AS "scheduledAt",
          status,
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt"
      `,
      [
        bracketMatchData.bracketMatchId,
        bracketMatchData.poolId,
        bracketMatchData.phase,
        bracketMatchData.matchNumber,
        bracketMatchData.homeTeamId || null,
        bracketMatchData.homeTeamName || null,
        bracketMatchData.awayTeamId || null,
        bracketMatchData.awayTeamName || null,
        bracketMatchData.homeResult ?? null,
        bracketMatchData.awayResult ?? null,
        bracketMatchData.scheduledAt || null,
        bracketMatchData.status || 'scheduled',
        Math.floor(Date.now() / 1000),
      ],
    );

    return result.rows[0];
  }

  async getBracketMatches(poolId: string, phase?: string) {
    if (phase) {
      const result = await this.postgres.query(
        `
          SELECT
            bracket_match_id AS "bracketMatchId",
            pool_id AS "poolId",
            phase,
            match_number AS "matchNumber",
            home_team_id AS "homeTeamId",
            home_team_name AS "homeTeamName",
            away_team_id AS "awayTeamId",
            away_team_name AS "awayTeamName",
            home_result AS "homeResult",
            away_result AS "awayResult",
            scheduled_at::text AS "scheduledAt",
            status,
            created_at::int AS "createdAt",
            updated_at::int AS "updatedAt"
          FROM final_phase_matches
          WHERE pool_id = 'all-pools' AND phase = $1
          ORDER BY match_number ASC
        `,
        [phase],
      );
      return result.rows;
    }

    const result = await this.postgres.query(
      `
        SELECT
          bracket_match_id AS "bracketMatchId",
          pool_id AS "poolId",
          phase,
          match_number AS "matchNumber",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          home_result AS "homeResult",
          away_result AS "awayResult",
          scheduled_at::text AS "scheduledAt",
          status,
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt"
        FROM final_phase_matches
        WHERE pool_id = 'all-pools'
        ORDER BY match_number ASC
      `,
    );
    return result.rows;
  }

  async updateBracketMatch(
    bracketMatchId: string,
    updates: {
      homeTeamId?: string;
      homeTeamName?: string;
      awayTeamId?: string;
      awayTeamName?: string;
      homeResult?: number;
      awayResult?: number;
      status?: string;
    },
  ) {
    const currentResult = await this.postgres.query(
      `
        SELECT
          bracket_match_id AS "bracketMatchId",
          pool_id AS "poolId",
          phase,
          match_number AS "matchNumber",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          home_result AS "homeResult",
          away_result AS "awayResult",
          scheduled_at::text AS "scheduledAt",
          status,
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt"
        FROM final_phase_matches
        WHERE bracket_match_id = $1
      `,
      [bracketMatchId],
    );

    const current = currentResult.rows[0];
    if (!current) {
      return null;
    }

    const result = await this.postgres.query(
      `
        UPDATE final_phase_matches
        SET
          home_team_id = $2,
          home_team_name = $3,
          away_team_id = $4,
          away_team_name = $5,
          home_result = $6,
          away_result = $7,
          status = $8,
          updated_at = $9
        WHERE bracket_match_id = $1
        RETURNING
          bracket_match_id AS "bracketMatchId",
          pool_id AS "poolId",
          phase,
          match_number AS "matchNumber",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          home_result AS "homeResult",
          away_result AS "awayResult",
          scheduled_at::text AS "scheduledAt",
          status,
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt"
      `,
      [
        bracketMatchId,
        updates.homeTeamId ?? current.homeTeamId ?? null,
        updates.homeTeamName ?? current.homeTeamName ?? null,
        updates.awayTeamId ?? current.awayTeamId ?? null,
        updates.awayTeamName ?? current.awayTeamName ?? null,
        updates.homeResult ?? current.homeResult ?? null,
        updates.awayResult ?? current.awayResult ?? null,
        updates.status ?? current.status,
        Math.floor(Date.now() / 1000),
      ],
    );

    return result.rows[0];
  }

  async deleteBracketMatch(bracketMatchId: string) {
    await this.postgres.query(
      `DELETE FROM final_phase_matches WHERE bracket_match_id = $1`,
      [bracketMatchId],
    );
    return { success: true };
  }

  async getAllBracketPredictionsForPool(poolId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          bracket_prediction_id AS "bracketPredictionId",
          pool_id AS "poolId",
          bracket_match_id AS "bracketMatchId",
          user_id AS "userId",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          points::int AS "points",
          is_evaluated AS "isEvaluated",
          home_team_exact_position AS "homeTeamExactPosition",
          away_team_exact_position AS "awayTeamExactPosition",
          home_team_correct_but_wrong_position AS "homeTeamCorrectButWrongPosition",
          away_team_correct_but_wrong_position AS "awayTeamCorrectButWrongPosition",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM final_phase_predictions
        WHERE pool_id = $1
      `,
      [poolId],
    );
    return result.rows;
  }

  async updateBracketPredictionPoints(
    bracketPredictionId: string,
    points: number,
    homeTeamExactPosition: boolean,
    awayTeamExactPosition: boolean,
    homeTeamCorrectButWrongPosition: boolean = false,
    awayTeamCorrectButWrongPosition: boolean = false,
  ) {
    await this.postgres.query(
      `
        UPDATE final_phase_predictions
        SET
          points = $2,
          is_evaluated = TRUE,
          home_team_exact_position = $3,
          away_team_exact_position = $4,
          home_team_correct_but_wrong_position = $5,
          away_team_correct_but_wrong_position = $6,
          evaluated_at = $7
        WHERE bracket_prediction_id = $1
      `,
      [
        bracketPredictionId,
        points,
        homeTeamExactPosition,
        awayTeamExactPosition,
        homeTeamCorrectButWrongPosition,
        awayTeamCorrectButWrongPosition,
        Math.floor(Date.now() / 1000),
      ],
    );
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
    const bracketPredictionId = `${poolId}-${bracketMatchId}-${userId}`;
    const now = Math.floor(Date.now() / 1000);

    const result = await this.postgres.query(
      `
        INSERT INTO final_phase_predictions (
          bracket_prediction_id,
          pool_id,
          bracket_match_id,
          user_id,
          home_team_id,
          home_team_name,
          away_team_id,
          away_team_name,
          points,
          is_evaluated,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, FALSE, $9, $9)
        ON CONFLICT (bracket_prediction_id)
        DO UPDATE SET
          home_team_id = EXCLUDED.home_team_id,
          home_team_name = EXCLUDED.home_team_name,
          away_team_id = EXCLUDED.away_team_id,
          away_team_name = EXCLUDED.away_team_name,
          updated_at = EXCLUDED.updated_at
        RETURNING
          bracket_prediction_id AS "bracketPredictionId",
          pool_id AS "poolId",
          bracket_match_id AS "bracketMatchId",
          user_id AS "userId",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          points::int AS "points",
          is_evaluated AS "isEvaluated",
          home_team_exact_position AS "homeTeamExactPosition",
          away_team_exact_position AS "awayTeamExactPosition",
          home_team_correct_but_wrong_position AS "homeTeamCorrectButWrongPosition",
          away_team_correct_but_wrong_position AS "awayTeamCorrectButWrongPosition",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
      `,
      [
        bracketPredictionId,
        poolId,
        bracketMatchId,
        userId,
        homeTeamId || null,
        homeTeamName || null,
        awayTeamId || null,
        awayTeamName || null,
        now,
      ],
    );

    return result.rows[0];
  }

  async getUserBracketPredictions(poolId: string, userId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          bracket_prediction_id AS "bracketPredictionId",
          pool_id AS "poolId",
          bracket_match_id AS "bracketMatchId",
          user_id AS "userId",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          points::int AS "points",
          is_evaluated AS "isEvaluated",
          home_team_exact_position AS "homeTeamExactPosition",
          away_team_exact_position AS "awayTeamExactPosition",
          home_team_correct_but_wrong_position AS "homeTeamCorrectButWrongPosition",
          away_team_correct_but_wrong_position AS "awayTeamCorrectButWrongPosition",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM final_phase_predictions
        WHERE pool_id = $1 AND user_id = $2
      `,
      [poolId, userId],
    );
    return result.rows;
  }

  async getBracketPrediction(poolId: string, bracketMatchId: string, userId: string) {
    const bracketPredictionId = `${poolId}-${bracketMatchId}-${userId}`;
    const result = await this.postgres.query(
      `
        SELECT
          bracket_prediction_id AS "bracketPredictionId",
          pool_id AS "poolId",
          bracket_match_id AS "bracketMatchId",
          user_id AS "userId",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          points::int AS "points",
          is_evaluated AS "isEvaluated",
          home_team_exact_position AS "homeTeamExactPosition",
          away_team_exact_position AS "awayTeamExactPosition",
          home_team_correct_but_wrong_position AS "homeTeamCorrectButWrongPosition",
          away_team_correct_but_wrong_position AS "awayTeamCorrectButWrongPosition",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM final_phase_predictions
        WHERE bracket_prediction_id = $1
      `,
      [bracketPredictionId],
    );
    return result.rows[0] || null;
  }

  async getAllBracketPredictionsForMatch(bracketMatchId: string) {
    const result = await this.postgres.query(
      `
        SELECT
          bracket_prediction_id AS "bracketPredictionId",
          pool_id AS "poolId",
          bracket_match_id AS "bracketMatchId",
          user_id AS "userId",
          home_team_id AS "homeTeamId",
          home_team_name AS "homeTeamName",
          away_team_id AS "awayTeamId",
          away_team_name AS "awayTeamName",
          points::int AS "points",
          is_evaluated AS "isEvaluated",
          home_team_exact_position AS "homeTeamExactPosition",
          away_team_exact_position AS "awayTeamExactPosition",
          home_team_correct_but_wrong_position AS "homeTeamCorrectButWrongPosition",
          away_team_correct_but_wrong_position AS "awayTeamCorrectButWrongPosition",
          created_at::int AS "createdAt",
          updated_at::int AS "updatedAt",
          evaluated_at::int AS "evaluatedAt"
        FROM final_phase_predictions
        WHERE bracket_match_id = $1
      `,
      [bracketMatchId],
    );

    return result.rows;
  }
}
