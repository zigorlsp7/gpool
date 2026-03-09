import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PostgresService } from './postgres.service';

@Injectable()
export class PostgresInitService implements OnModuleInit {
  private readonly logger = new Logger(PostgresInitService.name);

  constructor(private readonly postgres: PostgresService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
    await this.seedTeamsAndMatches();
    await this.seedBracketMatches();
  }

  private async ensureSchema(): Promise<void> {
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        picture TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pools (
        pool_id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        admin_name TEXT NOT NULL DEFAULT '',
        admin_email TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pools_admin_user_id ON pools(admin_user_id);

      CREATE TABLE IF NOT EXISTS pool_memberships (
        pool_id TEXT NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_email TEXT NOT NULL DEFAULT '',
        user_name TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (pool_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pool_memberships_user_id ON pool_memberships(user_id);

      CREATE TABLE IF NOT EXISTS teams (
        team_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_id TEXT NOT NULL,
        code TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_teams_group_id ON teams(group_id);

      CREATE TABLE IF NOT EXISTS group_phase_matches (
        match_id TEXT PRIMARY KEY,
        pool_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        home_team_id TEXT NOT NULL,
        away_team_id TEXT NOT NULL,
        home_team_name TEXT NOT NULL,
        away_team_name TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        deadline BIGINT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'group',
        status TEXT NOT NULL DEFAULT 'scheduled',
        home_result INTEGER,
        away_result INTEGER,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_group_phase_matches_pool_id ON group_phase_matches(pool_id);
      CREATE INDEX IF NOT EXISTS idx_group_phase_matches_pool_group ON group_phase_matches(pool_id, group_id);

      CREATE TABLE IF NOT EXISTS group_phase_predictions (
        prediction_id TEXT PRIMARY KEY,
        pool_id TEXT NOT NULL,
        match_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        is_correct BOOLEAN,
        is_exact_match BOOLEAN,
        points INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        evaluated_at BIGINT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_group_phase_predictions_unique ON group_phase_predictions(pool_id, match_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_group_phase_predictions_user_pool ON group_phase_predictions(user_id, pool_id);
      CREATE INDEX IF NOT EXISTS idx_group_phase_predictions_match_id ON group_phase_predictions(match_id);
      CREATE INDEX IF NOT EXISTS idx_group_phase_predictions_pool_id ON group_phase_predictions(pool_id);

      CREATE TABLE IF NOT EXISTS final_phase_matches (
        bracket_match_id TEXT PRIMARY KEY,
        pool_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        match_number INTEGER NOT NULL,
        home_team_id TEXT,
        home_team_name TEXT,
        away_team_id TEXT,
        away_team_name TEXT,
        home_result INTEGER,
        away_result INTEGER,
        scheduled_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'scheduled',
        created_at BIGINT NOT NULL,
        updated_at BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_final_phase_matches_pool_phase ON final_phase_matches(pool_id, phase);

      CREATE TABLE IF NOT EXISTS final_phase_predictions (
        bracket_prediction_id TEXT PRIMARY KEY,
        pool_id TEXT NOT NULL,
        bracket_match_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        home_team_id TEXT,
        home_team_name TEXT,
        away_team_id TEXT,
        away_team_name TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        is_evaluated BOOLEAN NOT NULL DEFAULT FALSE,
        home_team_exact_position BOOLEAN,
        away_team_exact_position BOOLEAN,
        home_team_correct_but_wrong_position BOOLEAN,
        away_team_correct_but_wrong_position BOOLEAN,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        evaluated_at BIGINT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_final_phase_predictions_unique ON final_phase_predictions(pool_id, bracket_match_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_final_phase_predictions_user_pool ON final_phase_predictions(user_id, pool_id);
      CREATE INDEX IF NOT EXISTS idx_final_phase_predictions_match_id ON final_phase_predictions(bracket_match_id);
      CREATE INDEX IF NOT EXISTS idx_final_phase_predictions_pool_id ON final_phase_predictions(pool_id);

      CREATE TABLE IF NOT EXISTS notifications (
        notification_id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        content TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at BIGINT NOT NULL,
        sent_at BIGINT,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON notifications(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications((metadata->>'eventId'));
    `);

    this.logger.log('Postgres schema verified');
  }

  private async seedTeamsAndMatches(): Promise<void> {
    const teamsCountResult = await this.postgres.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM teams`,
    );
    const matchesCountResult = await this.postgres.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM group_phase_matches WHERE pool_id = 'all-pools'`,
    );

    const teamsCount = teamsCountResult.rows[0]?.count ?? 0;
    const matchesCount = matchesCountResult.rows[0]?.count ?? 0;

    if (teamsCount >= 48 && matchesCount >= 72) {
      this.logger.log(`Seed data already present: ${teamsCount} teams, ${matchesCount} matches`);
      return;
    }

    const client = await this.postgres.getClient();
    try {
      await client.query('BEGIN');

      if (teamsCount < 48) {
        await client.query('DELETE FROM teams');
      }
      if (matchesCount < 72) {
        await client.query(`DELETE FROM group_phase_matches WHERE pool_id = 'all-pools'`);
      }

      const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      const teamNames = [
        ['Argentina', 'Brazil', 'France', 'Spain'],
        ['Germany', 'Italy', 'Netherlands', 'Portugal'],
        ['England', 'Belgium', 'Croatia', 'Denmark'],
        ['Uruguay', 'Colombia', 'Mexico', 'Chile'],
        ['Japan', 'South Korea', 'Australia', 'Saudi Arabia'],
        ['Morocco', 'Senegal', 'Tunisia', 'Egypt'],
        ['USA', 'Canada', 'Costa Rica', 'Jamaica'],
        ['Poland', 'Switzerland', 'Sweden', 'Norway'],
        ['Wales', 'Scotland', 'Ireland', 'Iceland'],
        ['Peru', 'Ecuador', 'Paraguay', 'Venezuela'],
        ['Iran', 'Qatar', 'UAE', 'Iraq'],
        ['Ghana', 'Nigeria', 'Cameroon', 'Ivory Coast'],
      ];

      type TeamSeed = { teamId: string; name: string; group: string; code: string };
      const teams: TeamSeed[] = [];

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const names = teamNames[i];
        for (let j = 0; j < names.length; j++) {
          const teamId = `${group}${j + 1}`;
          teams.push({
            teamId,
            name: names[j],
            group,
            code: names[j].substring(0, 3).toUpperCase(),
          });
        }
      }

      if (teamsCount < 48) {
        for (const team of teams) {
          await client.query(
            `
              INSERT INTO teams (team_id, name, group_id, code)
              VALUES ($1, $2, $3, $4)
            `,
            [team.teamId, team.name, team.group, team.code],
          );
        }
      }

      if (matchesCount < 72) {
        for (const group of groups) {
          const groupTeams = teams.filter((team) => team.group === group);
          const matchPairs: [number, number][] = [
            [0, 1],
            [0, 2],
            [0, 3],
            [1, 2],
            [1, 3],
            [2, 3],
          ];

          for (let i = 0; i < matchPairs.length; i++) {
            const [idx1, idx2] = matchPairs[i];
            const homeTeam = groupTeams[idx1];
            const awayTeam = groupTeams[idx2];
            const matchId = `${group}${i + 1}`;
            const scheduledAt = new Date(`2026-06-${String(i + 1).padStart(2, '0')}T12:00:00Z`).toISOString();
            const deadline = new Date('2026-06-08T00:00:00Z').getTime();

            await client.query(
              `
                INSERT INTO group_phase_matches (
                  match_id,
                  pool_id,
                  group_id,
                  home_team_id,
                  away_team_id,
                  home_team_name,
                  away_team_name,
                  scheduled_at,
                  deadline,
                  phase,
                  status,
                  created_at
                )
                VALUES ($1, 'all-pools', $2, $3, $4, $5, $6, $7, $8, 'group', 'scheduled', $9)
              `,
              [
                matchId,
                group,
                homeTeam.teamId,
                awayTeam.teamId,
                homeTeam.name,
                awayTeam.name,
                scheduledAt,
                deadline,
                Math.floor(Date.now() / 1000),
              ],
            );
          }
        }
      }

      await client.query('COMMIT');
      this.logger.log('Seeded teams and group phase matches');
    } catch (error: any) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to seed teams/matches: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  private async seedBracketMatches(): Promise<void> {
    const result = await this.postgres.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM final_phase_matches WHERE pool_id = 'all-pools'`,
    );
    const count = result.rows[0]?.count ?? 0;

    if (count >= 31) {
      return;
    }

    const client = await this.postgres.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM final_phase_matches WHERE pool_id = 'all-pools'`);

      const phases: Array<{ phase: string; matches: number }> = [
        { phase: '16th-finals', matches: 16 },
        { phase: '8th-finals', matches: 8 },
        { phase: 'quarter-finals', matches: 4 },
        { phase: 'semi-finals', matches: 2 },
        { phase: 'finals', matches: 1 },
      ];

      let matchNumber = 1;
      for (const phase of phases) {
        for (let i = 1; i <= phase.matches; i++) {
          const bracketMatchId = `all-pools-${phase.phase}-${i}`;
          await client.query(
            `
              INSERT INTO final_phase_matches (
                bracket_match_id,
                pool_id,
                phase,
                match_number,
                status,
                created_at
              )
              VALUES ($1, 'all-pools', $2, $3, 'scheduled', $4)
            `,
            [bracketMatchId, phase.phase, matchNumber++, Math.floor(Date.now() / 1000)],
          );
        }
      }

      await client.query('COMMIT');
      this.logger.log('Seeded final phase matches');
    } catch (error: any) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to seed bracket matches: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }
}
