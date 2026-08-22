import { keyed, ErrorKey } from '@nest-util/nest-error';
import { HttpStatus, Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import type {
  PushPayload,
  EmailPayload,
  SendPushResult,
} from '../interfaces/notify-payload.interface';
import { DeviceTokenEntity } from '../entities/device-token.entity';
import { NotificationEntity } from '../entities/notification.entity';
import { FcmService } from './fcm.service';
import { EmailService } from './email.service';
import { NOTIFY_GATEWAY, NOTIFICATION_CREATED_EVENT } from '../constants';
import type { NotificationsGateway } from '../notifications.gateway';

export type DevicePlatform = 'android' | 'ios' | 'web';

export interface NotifyHistoryQuery {
  userId?: string;
  channel?: 'push' | 'email';
  page?: number;
  limit?: number;
}

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly fcmService: FcmService,
    private readonly emailService: EmailService,
    @InjectRepository(DeviceTokenEntity)
    private readonly deviceTokenRepository: Repository<DeviceTokenEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @Optional()
    @Inject(NOTIFY_GATEWAY)
    private readonly notificationsGateway?: NotificationsGateway
  ) {}

  // ─── Device tokens ─────────────────────────────────────────

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: DevicePlatform = 'web',
    deviceId?: string
  ): Promise<DeviceTokenEntity> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { token },
    });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      if (deviceId) {
        existing.deviceId = deviceId;
      }
      return this.deviceTokenRepository.save(existing);
    }
    const entity = this.deviceTokenRepository.create({
      userId,
      token,
      platform,
      deviceId,
    });
    return this.deviceTokenRepository.save(entity);
  }

  async unregisterDeviceToken(
    userId: string,
    token: string
  ): Promise<boolean> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { token },
    });
    if (!existing) {
      return false;
    }
    if (existing.userId !== userId) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.NOTIFY_DEVICE_TOKEN_INVALID);
    }
    await this.deviceTokenRepository.remove(existing);
    return true;
  }

  async listDeviceTokens(userId: string): Promise<DeviceTokenEntity[]> {
    return this.deviceTokenRepository.find({ where: { userId } });
  }

  // ─── Push ──────────────────────────────────────────────────

  async push(userId: string, payload: PushPayload): Promise<SendPushResult> {
    const tokens = await this.listDeviceTokens(userId);
    if (tokens.length === 0) {
      this.logger.warn(`No device tokens registered for user ${userId}`);
      await this.recordNotification({
        userId,
        channel: 'push',
        provider: 'fcm',
        title: payload.title,
        body: payload.body,
        metadata: payload.data ?? undefined,
        status: 'failed',
        error: `No device tokens registered for user ${userId}`,
      });
      return { successCount: 0, failureCount: 0, results: [] };
    }

    let result: SendPushResult;
    try {
      result = await this.fcmService.sendToTokens(
        tokens.map((t) => t.token),
        payload
      );
    } catch (error) {
      const message =
        (error as Error)?.message ?? 'Unknown FCM delivery error';
      this.logger.error(`FCM delivery failed for user ${userId}: ${message}`);
      result = {
        successCount: 0,
        failureCount: 1,
        results: [
          {
            token: tokens[0].token,
            success: false,
            error: message,
          },
        ],
      };
    }

    await this.recordNotification({
      userId,
      channel: 'push',
      provider: 'fcm',
      title: payload.title,
      body: payload.body,
      metadata: payload.data ?? undefined,
      result,
    });

    const dead = this.fcmService.getDeadTokens(result);
    if (dead.length > 0) {
      await this.deviceTokenRepository.delete({ token: In(dead) });
      this.logger.log(`Pruned ${dead.length} invalid device tokens for user ${userId}`);
    }

    return result;
  }

  async pushToToken(
    token: string,
    payload: PushPayload
  ): Promise<SendPushResult> {
    let result: SendPushResult;
    try {
      result = await this.fcmService.sendToToken(token, payload);
    } catch (error) {
      const message =
        (error as Error)?.message ?? 'Unknown FCM delivery error';
      this.logger.error(`FCM delivery failed for token: ${message}`);
      result = {
        successCount: 0,
        failureCount: 1,
        results: [{ token, success: false, error: message }],
      };
    }
    await this.recordNotification({
      channel: 'push',
      provider: 'fcm',
      title: payload.title,
      body: payload.body,
      to: token,
      metadata: payload.data ?? undefined,
      result,
    });
    return result;
  }

  // ─── Email ─────────────────────────────────────────────────

  async email(payload: EmailPayload, userId?: string): Promise<{ success: true }> {
    const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    try {
      await this.emailService.send(payload);
      await this.recordNotification({
        userId,
        channel: 'email',
        provider: 'smtp',
        title: payload.subject,
        subject: payload.subject,
        body: payload.text ?? payload.html,
        to,
        status: 'sent',
      });
      return { success: true };
    } catch (error) {
      await this.recordNotification({
        userId,
        channel: 'email',
        provider: 'smtp',
        title: payload.subject,
        subject: payload.subject,
        to,
        status: 'failed',
        error: (error as Error)?.message ?? 'Unknown SMTP error',
      });
      throw error;
    }
  }

  // ─── History ───────────────────────────────────────────────

  async getNotifications(query: NotifyHistoryQuery): Promise<{
    data: NotificationEntity[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.channel) {
      where.channel = query.channel;
    }

    const [data, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Internal ──────────────────────────────────────────────

  private async recordNotification(input: {
    userId?: string;
    channel: 'push' | 'email';
    provider: 'fcm' | 'smtp';
    title?: string;
    body?: string;
    subject?: string;
    to?: string;
    status?: 'sent' | 'failed';
    error?: string;
    metadata?: Record<string, unknown>;
    result?: SendPushResult;
  }): Promise<NotificationEntity> {
    const status =
      input.status ??
      (input.result && input.result.failureCount > 0 ? 'failed' : 'sent');
    const error =
      input.error ??
      (input.result && input.result.failureCount > 0
        ? `${input.result.failureCount} delivery(ies) failed`
        : undefined);

    const entity = this.notificationRepository.create({
      userId: input.userId,
      channel: input.channel,
      provider: input.provider,
      title: input.title,
      body: input.body,
      subject: input.subject,
      to: input.to,
      status,
      error,
      metadata: input.metadata,
      sentAt: new Date(),
    });
    const saved = await this.notificationRepository.save(entity);

    if (input.userId && this.notificationsGateway) {
      this.notificationsGateway.emitToUser(
        input.userId,
        NOTIFICATION_CREATED_EVENT,
        saved
      );
    }

    return saved;
  }
}
