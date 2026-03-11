import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuthRepository } from './database/auth.repository';

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type SignedTransfer = {
  transfer: string;
  signature: string;
};

const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

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

  private buildTransferPayload(input: {
    userId: string;
    email: string;
    role: string;
    name: string | null;
    picture: string | null;
  }): SignedTransfer {
    const transferPayload = {
      userId: input.userId,
      email: input.email,
      role: input.role,
      name: input.name,
      picture: input.picture,
      exp: Math.floor(Date.now() / 1000) + 120,
      ver: 1 as const,
    };
    const transfer = Buffer.from(JSON.stringify(transferPayload), 'utf8').toString('base64url');
    const signature = this.signTransferPayload(transfer);
    return { transfer, signature };
  }

  async createGoogleTransferFromAccessToken(accessToken: string): Promise<SignedTransfer> {
    const token = accessToken.trim();
    if (!token) {
      throw new UnauthorizedException('Missing Google access token');
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!userInfoResponse.ok) {
      throw new UnauthorizedException('Google token validation failed');
    }

    const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
    const email = userInfo.email?.trim().toLowerCase();
    if (!email || userInfo.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const fullName =
      `${userInfo.given_name?.trim() ?? ''} ${userInfo.family_name?.trim() ?? ''}`.trim() ||
      userInfo.name?.trim() ||
      email;
    const picture = userInfo.picture?.trim() ?? '';

    let dbUser = await this.authRepository.getUserByEmail(email);

    if (!dbUser) {
      const userId = uuidv4();
      dbUser = await this.authRepository.createUser({
        userId,
        email,
        name: fullName,
        picture,
        role: 'user',
      });
      this.logger.log(`New user created from Google login: ${userId}`);
    } else {
      const updates: Record<string, unknown> = {};
      if (dbUser.name !== fullName) updates.name = fullName;
      if (dbUser.picture !== picture) updates.picture = picture;
      if (Object.keys(updates).length > 0) {
        dbUser = await this.authRepository.updateUser(dbUser.userId, updates);
      }
    }

    return this.buildTransferPayload({
      userId: dbUser.userId,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name || null,
      picture: dbUser.picture || null,
    });
  }
}
