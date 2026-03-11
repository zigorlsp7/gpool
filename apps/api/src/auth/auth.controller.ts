import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionUserGuard } from '../common/auth/session-user.guard';

type GoogleTransferRequest = {
  accessToken?: string;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google/transfer')
  @ApiOperation({ summary: 'Create signed transfer payload from a Google access token' })
  @ApiResponse({ status: 200, description: 'Returns transfer payload and signature' })
  @ApiResponse({ status: 401, description: 'Invalid Google access token' })
  async googleTransfer(@Body() body: GoogleTransferRequest) {
    return this.authService.createGoogleTransferFromAccessToken(body.accessToken?.trim() ?? '');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Returns current user information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(SessionUserGuard)
  async getMe(@Req() req: Request) {
    return req.user;
  }
}
