import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';
import { SendNotificationInput } from '../interfaces/notification.interface';
import { MailService } from './mail.service';
import { WebhookService } from './webhook.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
    private readonly mailService: MailService,
    private readonly webhookService: WebhookService
  ) {}

  async send(input: SendNotificationInput): Promise<NotificationEntity> {
    const notification = this.repo.create({
      channel: input.channel,
      recipientId: input.recipientId,
      payload: input.channel === 'mail'
        ? (input.mail as unknown as Record<string, unknown>)
        : (input.webhook?.payload ?? {}),
      metadata: input.metadata,
      status: 'pending',
    });

    await this.repo.save(notification);

    try {
      if (input.channel === 'mail') {
        if (!input.mail) {
          throw new Error('Mail input is required for mail channel');
        }
        await this.mailService.send(input.mail);
      } else if (input.channel === 'webhook') {
        if (!input.webhook) {
          throw new Error('Webhook input is required for webhook channel');
        }
        await this.webhookService.send(input.webhook);
      }

      notification.status = 'sent';
      await this.repo.save(notification);
    } catch (err) {
      notification.status = 'failed';
      notification.errorMessage = err instanceof Error ? err.message : String(err);
      await this.repo.save(notification);
      this.logger.error(`Notification ${notification.id} failed: ${notification.errorMessage}`);
    }

    return notification;
  }

  async findAll(options: {
    channel?: string;
    status?: string;
    recipientId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: NotificationEntity[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const qb = this.repo
      .createQueryBuilder('n')
      .orderBy('n.createdAt', 'DESC');

    if (options.channel) {
      qb.andWhere('n.channel = :channel', { channel: options.channel });
    }
    if (options.status) {
      qb.andWhere('n.status = :status', { status: options.status });
    }
    if (options.recipientId) {
      qb.andWhere('n.recipientId = :recipientId', { recipientId: options.recipientId });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }
}
