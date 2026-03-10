import {
  Controller,
  Get,
  Post,
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
import { MatchService } from './match.service';
import { SessionUserGuard } from '../../common/auth/session-user.guard';
import { Request } from 'express';

@ApiTags('matches')
@Controller('pools/:poolId/matches')
@UseGuards(SessionUserGuard)
@ApiBearerAuth()
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get()
  @ApiOperation({ summary: 'Get all matches for a pool' })
  @ApiResponse({ status: 200, description: 'List of matches organized by groups' })
  async getMatches(@Param('poolId') poolId: string) {
    return this.matchService.getMatchesByPool(poolId);
  }

  @Get('teams')
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'List of all teams' })
  async getAllTeams() {
    return this.matchService.getAllTeams();
  }

  @Get('teams/group/:group')
  @ApiOperation({ summary: 'Get teams by group' })
  @ApiResponse({ status: 200, description: 'List of teams in the group' })
  async getTeamsByGroup(@Param('group') group: string) {
    return this.matchService.getTeamsByGroup(group);
  }

  @Post(':matchId/predict')
  @ApiOperation({ summary: 'Submit a prediction for a match' })
  @ApiResponse({ status: 200, description: 'Prediction submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid prediction or deadline passed' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  async submitPrediction(
    @Param('poolId') poolId: string,
    @Param('matchId') matchId: string,
    @Body() body: { homeScore: number; awayScore: number },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.matchService.submitPrediction(
      poolId,
      matchId,
      user.userId,
      body.homeScore,
      body.awayScore,
    );
  }

  @Get('predictions')
  @ApiOperation({ summary: 'Get user predictions for a pool' })
  @ApiResponse({ status: 200, description: 'List of user predictions' })
  async getUserPredictions(@Param('poolId') poolId: string, @Req() req: Request) {
    const user = req.user as any;
    return this.matchService.getUserPredictions(poolId, user.userId);
  }

  @Post(':matchId/results')
  @ApiOperation({ summary: 'Update match results (Admin only)' })
  @ApiResponse({ status: 200, description: 'Match results updated and predictions evaluated' })
  @ApiResponse({ status: 400, description: 'Invalid results' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  async updateMatchResults(
    @Param('poolId') poolId: string,
    @Param('matchId') matchId: string,
    @Body() body: { homeResult: number; awayResult: number; winnerPoints?: number; exactResultPoints?: number },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    // Check if user is admin
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only administrators can update match results');
    }
    const scoringConfig = body.winnerPoints !== undefined || body.exactResultPoints !== undefined
      ? { winnerPoints: body.winnerPoints ?? 1, exactResultPoints: body.exactResultPoints ?? 3 }
      : undefined;
    return this.matchService.updateMatchResults(matchId, body.homeResult, body.awayResult, poolId, scoringConfig);
  }

  @Get('ranking')
  @ApiOperation({ summary: 'Get pool ranking by points' })
  @ApiResponse({ status: 200, description: 'Pool ranking' })
  async getPoolRanking(@Param('poolId') poolId: string) {
    return this.matchService.getPoolRanking(poolId);
  }
}
