import { Global, Module } from '@nestjs/common';
import { PostgresInitService } from './postgres-init.service';
import { PostgresService } from './postgres.service';

@Global()
@Module({
  providers: [PostgresService, PostgresInitService],
  exports: [PostgresService],
})
export class DatabaseModule {}
