import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

class ScoringRulesDto {
    @ApiProperty({ description: 'Points for exact score match', example: 10 })
    @IsOptional()
    exactScore?: number;

    @ApiProperty({ description: 'Points for correct result (win/draw/loss)', example: 5 })
    @IsOptional()
    correctResult?: number;

    @ApiProperty({ description: 'Points for correct home score', example: 2 })
    @IsOptional()
    correctHomeScore?: number;

    @ApiProperty({ description: 'Points for correct away score', example: 2 })
    @IsOptional()
    correctAwayScore?: number;
}

class MatchSelectionDto {
    @ApiPropertyOptional({ description: 'Competition name', example: 'Premier League' })
    @IsOptional()
    @IsString()
    competition?: string;

    @ApiPropertyOptional({ description: 'Season', example: '2024-2025' })
    @IsOptional()
    @IsString()
    season?: string;
}

class PoolSettingsDto {
    @ApiProperty({ description: 'Is pool public (anyone can join)', example: false })
    @IsOptional()
    isPublic?: boolean;

    @ApiProperty({ description: 'Is pool invite-only', example: true })
    @IsOptional()
    inviteOnly?: boolean;

    @ApiProperty({ description: 'Maximum number of members', example: 50 })
    @IsOptional()
    maxMembers?: number;

    @ApiPropertyOptional({ description: 'Prediction deadline rule', example: 'match_start_time' })
    @IsOptional()
    @IsString()
    predictionDeadline?: string;
}

export class PoolConfigDto {
    @ApiPropertyOptional({ type: ScoringRulesDto, description: 'Scoring rules' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ScoringRulesDto)
    scoring?: ScoringRulesDto;

    @ApiPropertyOptional({ type: MatchSelectionDto, description: 'Match selection criteria' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => MatchSelectionDto)
    matchSelection?: MatchSelectionDto;

    @ApiPropertyOptional({ type: PoolSettingsDto, description: 'Pool settings' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => PoolSettingsDto)
    settings?: PoolSettingsDto;
}

export class CreatePoolDto {
    @ApiProperty({ description: 'Pool name', example: 'Premier League 2024', minLength: 3, maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ description: 'Pool description', example: 'Season-long pool for Premier League', maxLength: 500 })
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
