import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from '../database/postgres.service';
import { EmailService } from './email/email.service';

type NotificationStatus = 'pending' | 'sent' | 'failed';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly postgres: PostgresService,
    private readonly emailService: EmailService,
  ) {}

  private async createNotification(input: {
    userId?: string;
    recipient: string;
    subject: string;
    metadata?: Record<string, any>;
    status?: NotificationStatus;
    content?: string;
  }): Promise<string> {
    const notificationId = uuidv4();
    await this.postgres.query(
      `
        INSERT INTO notifications (
          notification_id,
          user_id,
          type,
          status,
          recipient,
          subject,
          content,
          metadata,
          created_at,
          retry_count
        )
        VALUES ($1, $2, 'email', $3, $4, $5, $6, $7::jsonb, $8, 0)
      `,
      [
        notificationId,
        input.userId || null,
        input.status || 'pending',
        input.recipient,
        input.subject,
        input.content || null,
        JSON.stringify(input.metadata || {}),
        Math.floor(Date.now() / 1000),
      ],
    );
    return notificationId;
  }

  private async markNotificationSent(notificationId: string): Promise<void> {
    await this.postgres.query(
      `
        UPDATE notifications
        SET status = 'sent', sent_at = $2
        WHERE notification_id = $1
      `,
      [notificationId, Math.floor(Date.now() / 1000)],
    );
  }

  private async markNotificationFailed(notificationId: string, errorMessage: string): Promise<void> {
    await this.postgres.query(
      `
        UPDATE notifications
        SET
          status = 'failed',
          error_message = $2,
          retry_count = retry_count + 1
        WHERE notification_id = $1
      `,
      [notificationId, errorMessage],
    );
  }

  private async alreadyProcessedEvent(eventId: string): Promise<boolean> {
    const result = await this.postgres.query<{ notificationId: string }>(
      `
        SELECT notification_id AS "notificationId"
        FROM notifications
        WHERE metadata->>'eventId' = $1
        LIMIT 1
      `,
      [eventId],
    );
    return result.rows.length > 0;
  }

  async sendPoolInvitation(data: {
    to: string;
    poolName: string;
    poolId: string;
    inviterEmail: string;
    invitedBy?: string;
  }): Promise<void> {
    const subject = `You've been invited to join ${data.poolName} on GPool`;
    const notificationId = await this.createNotification({
      userId: data.invitedBy,
      recipient: data.to,
      subject,
      metadata: {
        eventType: 'user_invited_to_pool',
        poolId: data.poolId,
        poolName: data.poolName,
        inviterEmail: data.inviterEmail,
      },
    });

    try {
      await this.emailService.sendPoolInvitation({
        to: data.to,
        poolName: data.poolName,
        poolId: data.poolId,
        inviterEmail: data.inviterEmail,
      });
      await this.markNotificationSent(notificationId);
    } catch (error: any) {
      await this.markNotificationFailed(notificationId, error.message);
      throw error;
    }
  }

  async sendPoolAccessRequest(data: {
    to?: string;
    poolName: string;
    poolId: string;
    requesterEmail: string;
    requesterUserId: string;
    adminUserId: string;
  }): Promise<void> {
    const recipient = data.to || '';
    const subject = `Access Request for ${data.poolName} on GPool`;
    const notificationId = await this.createNotification({
      userId: data.adminUserId,
      recipient,
      subject,
      metadata: {
        eventType: 'pool_access_requested',
        poolId: data.poolId,
        poolName: data.poolName,
        requesterEmail: data.requesterEmail,
        requesterUserId: data.requesterUserId,
      },
    });

    if (!recipient) {
      this.logger.warn(
        `Skipping pool access request email; admin email not available for pool ${data.poolId}`,
      );
      return;
    }

    try {
      await this.emailService.sendPoolAccessRequest({
        to: recipient,
        poolName: data.poolName,
        poolId: data.poolId,
        requesterEmail: data.requesterEmail,
        requesterUserId: data.requesterUserId,
      });
      await this.markNotificationSent(notificationId);
    } catch (error: any) {
      await this.markNotificationFailed(notificationId, error.message);
      throw error;
    }
  }

  async sendPoolAccessGranted(data: {
    to?: string;
    poolName: string;
    poolId: string;
    userId: string;
    userName?: string;
  }): Promise<void> {
    const recipient = data.to || '';
    const subject = `Access granted to ${data.poolName} on GPool`;
    const notificationId = await this.createNotification({
      userId: data.userId,
      recipient,
      subject,
      metadata: {
        eventType: 'pool_access_granted',
        poolId: data.poolId,
        poolName: data.poolName,
      },
    });

    if (!recipient) {
      this.logger.warn(`Skipping pool access granted email; user email missing for ${data.userId}`);
      return;
    }

    try {
      await this.emailService.sendPoolAccessGranted({
        to: recipient,
        poolName: data.poolName,
        poolId: data.poolId,
        userName: data.userName,
      });
      await this.markNotificationSent(notificationId);
    } catch (error: any) {
      await this.markNotificationFailed(notificationId, error.message);
      throw error;
    }
  }

  async sendUserAcceptedInvitation(data: {
    to?: string;
    poolName: string;
    poolId: string;
    userId: string;
    userName: string;
    userEmail: string;
    adminUserId: string;
    eventId?: string;
  }): Promise<void> {
    const recipient = data.to || '';

    if (data.eventId && (await this.alreadyProcessedEvent(data.eventId))) {
      this.logger.log(`Skipping duplicate invitation-accepted notification for event ${data.eventId}`);
      return;
    }

    const subject = `${data.userName} accepted your invitation to ${data.poolName} on GPool`;
    const notificationId = await this.createNotification({
      userId: data.adminUserId,
      recipient,
      subject,
      metadata: {
        eventId: data.eventId,
        eventType: 'user_accepted_pool_invitation',
        poolId: data.poolId,
        poolName: data.poolName,
        userId: data.userId,
        userEmail: data.userEmail,
      },
    });

    if (!recipient) {
      this.logger.warn(
        `Skipping user-accepted-invitation email; admin email missing for pool ${data.poolId}`,
      );
      return;
    }

    try {
      await this.emailService.sendUserAcceptedInvitation({
        to: recipient,
        poolName: data.poolName,
        poolId: data.poolId,
        userName: data.userName,
        userEmail: data.userEmail,
      });
      await this.markNotificationSent(notificationId);
    } catch (error: any) {
      await this.markNotificationFailed(notificationId, error.message);
      throw error;
    }
  }
}
