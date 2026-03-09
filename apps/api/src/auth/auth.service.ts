import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { createHmac } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuthRepository } from './database/auth.repository';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private configService: ConfigService,
    private authRepository: AuthRepository,
  ) {}

  private signTransferPayload(encodedPayload: string): string {
    const secret = this.configService.get<string>('AUTH_SESSION_SECRET', '').trim();
    if (!secret) {
      throw new UnauthorizedException('AUTH_SESSION_SECRET is not configured');
    }
    return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  }

  async handleGoogleCallback(req: any, res: Response) {
    try {
      const user = req.user; // From Passport Google strategy
      if (!user) {
        throw new UnauthorizedException('Authentication failed');
      }

      // Check if user exists
      let dbUser = await this.authRepository.getUserByEmail(user.email);

      if (!dbUser) {
        // Create new user
        const userId = uuidv4();
        dbUser = await this.authRepository.createUser({
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
          dbUser = await this.authRepository.updateUser(dbUser.userId, updates);
        }
      }

      const transferPayload = {
        userId: dbUser.userId,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name || null,
        picture: dbUser.picture || null,
        exp: Math.floor(Date.now() / 1000) + 120,
        ver: 1 as const,
      };
      const encodedPayload = Buffer.from(JSON.stringify(transferPayload), 'utf8').toString('base64url');
      const signature = this.signTransferPayload(encodedPayload);

      // Redirect to frontend callback with signed transfer payload.
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const redirectUrl = `${frontendUrl}/auth/callback?transfer=${encodeURIComponent(encodedPayload)}&sig=${encodeURIComponent(signature)}`;

      res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error(`Error in Google OAuth callback: ${error.message}`, error.stack);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      // Redirect to login with error message instead of error page
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
  }
}
