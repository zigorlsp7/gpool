import { IsString, IsOptional, MinLength, MaxLength, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoolConfigDto } from './create-pool.dto';

export class UpdatePoolDto {
  @ApiPropertyOptional({ description: 'Pool name', example: 'Premier League 2024', minLength: 3, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Pool description', example: 'Season-long pool', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: PoolConfigDto, description: 'Pool configuration' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PoolConfigDto)
  config?: PoolConfigDto;
}
