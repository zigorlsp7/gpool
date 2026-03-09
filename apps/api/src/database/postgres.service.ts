import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: Number(this.configService.get<string>('DB_PORT', '5432')),
      user: this.configService.get<string>('DB_USER', 'app'),
      password: this.configService.get<string>('DB_PASSWORD', 'app'),
      database: this.configService.get<string>('DB_NAME', 'gpool'),
      max: Number(this.configService.get<string>('DB_POOL_MAX', '20')),
      idleTimeoutMillis: Number(this.configService.get<string>('DB_IDLE_TIMEOUT_MS', '30000')),
      connectionTimeoutMillis: Number(this.configService.get<string>('DB_CONNECT_TIMEOUT_MS', '5000')),
    });

    this.pool.on('error', (err) => {
      this.logger.error(`Unexpected Postgres pool error: ${err.message}`, err.stack);
    });
  }

  async query<T = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async ping(): Promise<void> {
    await this.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
