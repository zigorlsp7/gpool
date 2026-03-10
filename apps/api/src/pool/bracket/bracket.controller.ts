import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BracketService } from './bracket.service';
import { SessionUserGuard } from '../../common/auth/session-user.guard';
import { Request } from 'express';

@ApiTags('bracket')
@Controller('pools/:poolId/bracket')
@UseGuards(SessionUserGuard)
@ApiBearerAuth()
export class BracketController {
  constructor(private readonly bracketService: BracketService) {}

  @Get()
  @ApiOperation({ summary: 'Get bracket structure for a pool' })
  @ApiResponse({ status: 200, description: 'Bracket structure retrieved successfully' })
  async getBracket(@Param('poolId') poolId: string) {
    return this.bracketService.getBracketStructure(poolId);
  }

  @Post('phases/:phase')
  @ApiOperation({ summary: 'Create a bracket phase (Admin only)' })
  @ApiResponse({ status: 201, description: 'Phase created successfully' })
  @ApiResponse({ status: 400, description: 'Phase already exists' })
  async createPhase(
    @Param('poolId') poolId: string,
    @Param('phase') phase: string,
    @Body() body: { numberOfMatches: number; forceRecreate?: boolean },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only administrators can create bracket phases');
    }
    return this.bracketService.createBracketPhase(poolId, phase as any, body.numberOfMatches, body.forceRecreate || false);
  }

  @Put('matches/:bracketMatchId/team')
  @ApiOperation({ summary: 'Update team in bracket match (Admin only)' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  async updateTeam(
    @Param('poolId') poolId: string,
    @Param('bracketMatchId') bracketMatchId: string,
    @Body() body: { side: 'home' | 'away'; teamId: string; teamName: string },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only administrators can update bracket matches');
    }
    return this.bracketService.updateBracketMatchTeam(
      bracketMatchId,
      poolId,
      body.side,
      body.teamId,
      body.teamName,
    );
  }

  @Put('matches/:bracketMatchId/result')
  @ApiOperation({ summary: 'Update result in bracket match (Admin only)' })
  @ApiResponse({ status: 200, description: 'Result updated successfully' })
  async updateResult(
    @Param('poolId') poolId: string,
    @Param('bracketMatchId') bracketMatchId: string,
    @Body() body: { homeResult: number; awayResult: number; exactPositionPoints?: number; correctTeamWrongPositionPoints?: number },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only administrators can update bracket match results');
    }
    return this.bracketService.updateBracketMatchResult(
      bracketMatchId,
      poolId,
      body.homeResult,
      body.awayResult,
      body.exactPositionPoints,
      body.correctTeamWrongPositionPoints,
    );
  }

  @Post('matches/:bracketMatchId/predict')
  @ApiOperation({ summary: 'Create or update bracket prediction' })
  @ApiResponse({ status: 200, description: 'Prediction saved successfully' })
  async createPrediction(
    @Param('poolId') poolId: string,
    @Param('bracketMatchId') bracketMatchId: string,
    @Body() body: { homeTeamId: string; homeTeamName: string; awayTeamId: string; awayTeamName: string },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.bracketService.createBracketPrediction(
      poolId,
      bracketMatchId,
      user.userId,
      body.homeTeamId,
      body.homeTeamName,
      body.awayTeamId,
      body.awayTeamName,
    );
  }

  @Get('predictions')
  @ApiOperation({ summary: 'Get user bracket predictions for a pool' })
  @ApiResponse({ status: 200, description: 'List of bracket predictions' })
  async getUserPredictions(@Param('poolId') poolId: string, @Req() req: Request) {
    const user = req.user as any;
    return this.bracketService.getUserBracketPredictions(poolId, user.userId);
  }

  @Post('re-evaluate')
  @ApiOperation({ summary: 'Re-evaluate all bracket matches for a pool (Admin only)' })
  @ApiResponse({ status: 200, description: 'All matches re-evaluated successfully' })
  async reEvaluateAll(@Param('poolId') poolId: string, @Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only administrators can re-evaluate bracket matches');
    }
    return this.bracketService.reEvaluateAllBracketMatches(poolId);
  }
}
