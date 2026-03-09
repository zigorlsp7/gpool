import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

export interface PoolInvitationEmailData {
  to: string;
  poolName: string;
  poolId: string;
  inviterEmail: string;
}

export interface PoolAccessRequestEmailData {
  to: string;
  poolName: string;
  poolId: string;
  requesterEmail: string;
  requesterUserId: string;
}

export interface PoolAccessGrantedEmailData {
  to: string;
  poolName: string;
  poolId: string;
  userName?: string;
}

export interface UserAcceptedInvitationEmailData {
  to: string;
  poolName: string;
  poolId: string;
  userName: string;
  userEmail: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const smtpSecure = (this.configService.get<string>('SMTP_SECURE', 'false') || 'false').toLowerCase() === 'true' || smtpPort === 465;
    const smtpUser = this.configService.get<string>('SMTP_USER', '');
    const smtpPass = this.configService.get<string>('SMTP_PASS', '');

    if (smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      this.logger.warn('SMTP credentials not configured; notification e-mails will be skipped');
    }

    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
  }

  private async loadTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    const candidates = [
      path.join(process.cwd(), 'src', 'notification', 'templates', 'emails', `${templateName}.hbs`),
      path.join(__dirname, '..', 'templates', 'emails', `${templateName}.hbs`),
      path.join(process.cwd(), 'dist', 'notification', 'templates', 'emails', `${templateName}.hbs`),
      path.join(process.cwd(), 'dist', 'apps', 'api', 'src', 'notification', 'templates', 'emails', `${templateName}.hbs`),
    ];

    const templatePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!templatePath) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const content = fs.readFileSync(templatePath, 'utf-8');
    return handlebars.compile(content)(data);
  }

  private async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`Email skipped (SMTP disabled): ${subject} -> ${to}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM', 'noreply@gpool.local'),
      to,
      subject,
      html,
    });
  }

  async sendPoolInvitation(data: PoolInvitationEmailData): Promise<void> {
    const html = await this.loadTemplate('pool-invitation', {
      poolName: data.poolName,
      poolId: data.poolId,
      inviterEmail: data.inviterEmail,
      acceptUrl: `${this.frontendUrl}/pools/${data.poolId}/accept`,
      poolUrl: `${this.frontendUrl}/pools/${data.poolId}`,
      frontendUrl: this.frontendUrl,
    });

    await this.sendMail(data.to, `You've been invited to join ${data.poolName} on GPool`, html);
  }

  async sendPoolAccessRequest(data: PoolAccessRequestEmailData): Promise<void> {
    const html = await this.loadTemplate('pool-access-request', {
      poolName: data.poolName,
      poolId: data.poolId,
      requesterEmail: data.requesterEmail,
      requesterUserId: data.requesterUserId,
      frontendUrl: this.frontendUrl,
      acceptUrl: `${this.frontendUrl}/pools/${data.poolId}/accept-request/${data.requesterUserId}`,
      poolUrl: `${this.frontendUrl}/pools/${data.poolId}`,
    });

    await this.sendMail(data.to, `Pool Access Request for ${data.poolName} on GPool`, html);
  }

  async sendPoolAccessGranted(data: PoolAccessGrantedEmailData): Promise<void> {
    const html = await this.loadTemplate('pool-access-granted', {
      poolName: data.poolName,
      poolId: data.poolId,
      userName: data.userName || 'there',
      frontendUrl: this.frontendUrl,
      poolUrl: `${this.frontendUrl}/pools/${data.poolId}`,
    });

    await this.sendMail(data.to, `Access granted to ${data.poolName} on GPool`, html);
  }

  async sendUserAcceptedInvitation(data: UserAcceptedInvitationEmailData): Promise<void> {
    const html = await this.loadTemplate('user-accepted-invitation', {
      poolName: data.poolName,
      poolId: data.poolId,
      userName: data.userName,
      userEmail: data.userEmail,
      frontendUrl: this.frontendUrl,
      poolUrl: `${this.frontendUrl}/pools/${data.poolId}`,
    });

    await this.sendMail(data.to, `${data.userName} accepted your invitation to ${data.poolName} on GPool`, html);
  }
}
