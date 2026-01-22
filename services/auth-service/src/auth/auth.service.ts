import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from './database/dynamodb.service';
import { KafkaService } from './kafka/kafka.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private dynamoDBService: DynamoDBService,
    private kafkaService: KafkaService,
  ) {}

  async handleGoogleCallback(req: any, res: Response) {
    try {
      const user = req.user; // From Passport Google strategy
      if (!user) {
        throw new UnauthorizedException('Authentication failed');
      }

      // Check if user exists
      let dbUser = await this.dynamoDBService.getUserByEmail(user.email);

      if (!dbUser) {
        // Create new user
        const userId = uuidv4();
        dbUser = await this.dynamoDBService.createUser({
          userId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          picture: user.picture,
          role: 'user',
        });

        // Publish UserCreated event (if needed, can be done by user-service)
        this.logger.log(`New user created: ${userId}`);
      } else {
        // Update user info if changed
        const updates: Record<string, any> = {};
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        
        if (dbUser.name !== fullName) updates.name = fullName;
        if (dbUser.picture !== user.picture) updates.picture = user.picture;

        if (Object.keys(updates).length > 0) {
          dbUser = await this.dynamoDBService.updateUser(dbUser.userId, updates);
        }
      }

      // Generate tokens
      const tokens = await this.generateTokens(dbUser.userId, dbUser.email, dbUser.role);

      // Publish authentication event (non-blocking - don't wait for Kafka)
      this.kafkaService.publishUserAuthenticated(dbUser.userId).catch((error) => {
        this.logger.warn(`Failed to publish user authenticated event: ${error.message}`);
      });

      // Redirect to frontend with tokens
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error(`Error in Google OAuth callback: ${error.message}`, error.stack);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      // Redirect to login with error message instead of error page
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  async generateTokens(userId: string, email: string, role: string) {
    const payload = {
      sub: userId,
      email,
      role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshTokenId = uuidv4();
    const refreshTokenExpiresIn = this.configService.get<number>(
      'JWT_REFRESH_EXPIRES_IN',
      7 * 24 * 60 * 60, // 7 days in seconds
    );
    const expiresAt = Math.floor(Date.now() / 1000) + refreshTokenExpiresIn;

    // Store refresh token in DynamoDB
    await this.dynamoDBService.saveRefreshToken(refreshTokenId, userId, expiresAt);

    // Sign refresh token with different secret
    const refreshToken = this.jwtService.sign(
      { sub: userId, tokenId: refreshTokenId },
      {
        expiresIn: `${refreshTokenExpiresIn}s`,
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret'),
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: refreshTokenExpiresIn,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret'),
      });

      const tokenId = decoded.tokenId;
      if (!tokenId) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token exists in database
      const storedToken = await this.dynamoDBService.getRefreshToken(tokenId);
      if (!storedToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      // Check if token is expired
      if (storedToken.expiresAt < Math.floor(Date.now() / 1000)) {
        await this.dynamoDBService.deleteRefreshToken(tokenId);
        throw new UnauthorizedException('Refresh token expired');
      }

      // Get user
      const user = await this.dynamoDBService.getUser(storedToken.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.userId, user.email, user.role);

      // Delete old refresh token
      await this.dynamoDBService.deleteRefreshToken(tokenId);

      return tokens;
    } catch (error) {
      this.logger.error(`Error refreshing token: ${error.message}`, error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      // Verify and decode refresh token
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret'),
      });

      const tokenId = decoded.tokenId;
      const userId = decoded.sub;

      if (tokenId) {
        // Delete refresh token from database
        await this.dynamoDBService.deleteRefreshToken(tokenId);
      }

      // Publish logout event (non-blocking - don't wait for Kafka)
      if (userId) {
        this.kafkaService.publishUserLoggedOut(userId).catch((error) => {
          this.logger.warn(`Failed to publish user logged out event: ${error.message}`);
        });
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Error during logout: ${error.message}`, error.stack);
      // Even if token is invalid, consider logout successful
      return { message: 'Logged out successfully' };
    }
  }
}
