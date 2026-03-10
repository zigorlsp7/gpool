import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';

export interface AuthUserRow {
  userId: string;
  email: string;
  name: string;
  picture: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly postgres: PostgresService) {}

  async createUser(userData: {
    userId: string;
    email: string;
    name: string;
    picture?: string;
    role?: string;
    createdAt?: string;
    updatedAt?: string;
  }): Promise<AuthUserRow> {
    const createdAt = userData.createdAt || new Date().toISOString();
    const updatedAt = userData.updatedAt || createdAt;

    const result = await this.postgres.query<AuthUserRow>(
      `
        INSERT INTO users (user_id, email, name, picture, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          user_id AS "userId",
          email,
          name,
          picture,
          role,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `,
      [
        userData.userId,
        userData.email,
        userData.name,
        userData.picture || '',
        userData.role || 'user',
        createdAt,
        updatedAt,
      ],
    );

    return result.rows[0];
  }

  async getUser(userId: string): Promise<AuthUserRow | null> {
    const result = await this.postgres.query<AuthUserRow>(
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

  async getUserByEmail(email: string): Promise<AuthUserRow | null> {
    const result = await this.postgres.query<AuthUserRow>(
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
        WHERE email = $1
      `,
      [email],
    );

    return result.rows[0] || null;
  }

  async updateUser(userId: string, updates: Record<string, any>): Promise<AuthUserRow> {
    const currentUser = await this.getUser(userId);
    if (!currentUser) {
      throw new Error(`User ${userId} not found`);
    }

    const next = {
      name: updates.name ?? currentUser.name,
      picture: updates.picture ?? currentUser.picture,
      role: updates.role ?? currentUser.role,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.postgres.query<AuthUserRow>(
      `
        UPDATE users
        SET
          name = $2,
          picture = $3,
          role = $4,
          updated_at = $5
        WHERE user_id = $1
        RETURNING
          user_id AS "userId",
          email,
          name,
          picture,
          role,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `,
      [userId, next.name, next.picture, next.role, next.updatedAt],
    );

    return result.rows[0];
  }
}
