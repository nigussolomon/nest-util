import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PAYMENT_OPTIONS } from '../constants';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import type { WebhookEvent } from '../interfaces/payment-webhook.interface';
import { SubscriptionEntity } from '../entities/subscription.entity';
import type { CreateSubscriptionDto } from '../dtos/create-subscription.dto';

const VALID_SUBSCRIPTION_TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'failed', 'canceled'],
  active: ['past_due', 'canceled', 'trialing'],
  past_due: ['active', 'canceled'],
  trialing: ['active', 'canceled'],
  canceled: [],
  failed: [],
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @Inject(PAYMENT_OPTIONS)
    private readonly options: NestPaymentOptions,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>
  ) {}

  // ─── Create ─────────────────────────────────────────────────

  async create(
    userId: string,
    dto: CreateSubscriptionDto
  ): Promise<{
    subscription: SubscriptionEntity;
    checkoutUrl?: string;
    error?: string;
  }> {
    // Idempotency: check for existing subscription with same key
    if (dto.idempotencyKey) {
      const existing = await this.subscriptionRepository.findOneBy({
        idempotencyKey: dto.idempotencyKey,
      });
      if (existing) {
        this.logger.log(
          `Idempotent subscription: returning existing ${existing.id}`
        );
        return {
          subscription: existing,
          checkoutUrl: existing.metadata?.checkoutUrl as string | undefined,
        };
      }
    }

    // Create DB record first
    const entity = this.subscriptionRepository.create({
      provider: dto.provider ?? this.options.providers[0]?.id ?? 'unknown',
      providerSubscriptionId: undefined,
      userId,
      amount: dto.amount,
      currency: dto.currency,
      status: 'pending',
      description: dto.description,
      customerEmail: dto.customerEmail,
      interval: dto.interval,
      intervalCount: dto.intervalCount ?? 1,
      idempotencyKey: dto.idempotencyKey,
    });

    const saved = await this.subscriptionRepository.save(entity);

    // Resolve provider
    const provider = this.getProvider(saved.provider);
    if (!provider.createSubscription) {
      throw new BadRequestException(
        `Provider '${provider.id}' does not support subscriptions`
      );
    }

    try {
      const result = await provider.createSubscription({
        amount: dto.amount,
        currency: dto.currency,
        customerEmail: dto.customerEmail,
        customerName: dto.customerName,
        customerLastName: dto.customerLastName,
        interval: dto.interval,
        intervalCount: dto.intervalCount,
        description: dto.description,
        idempotencyKey: dto.idempotencyKey,
        callbackUrl: dto.callbackUrl,
        metadata: { subscriptionId: saved.id },
      });

      saved.providerSubscriptionId = result.providerSubscriptionId;
      saved.providerPaymentId = result.providerReference;
      saved.status = result.status === 'succeeded' ? 'active' : result.status as any;
      saved.currentPeriodStart = result.currentPeriodStart;
      saved.currentPeriodEnd = result.currentPeriodEnd;
      saved.metadata = {
        ...saved.metadata,
        ...result.metadata,
        checkoutUrl: (result.metadata as any)?.checkoutUrl,
      };

      const updated = await this.subscriptionRepository.save(saved);

      this.logger.log(
        `Subscription created: ${updated.id} → ${updated.providerSubscriptionId}`
      );

      return {
        subscription: updated,
        checkoutUrl: updated.metadata?.checkoutUrl as string | undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.error(`Subscription provider call failed: ${message}`);

      return { subscription: saved, error: message };
    }
  }

  // ─── Webhook ────────────────────────────────────────────────

  async handleWebhook(event: WebhookEvent): Promise<SubscriptionEntity | null> {
    if (!event.isSubscriptionEvent || !event.providerSubscriptionId) {
      return null;
    }

    let entity = await this.subscriptionRepository.findOneBy({
      provider: event.provider,
      providerSubscriptionId: event.providerSubscriptionId,
    });

    if (entity) {
      if (
        event.status &&
        this.isValidTransition(entity.status, event.status)
      ) {
        entity.status = event.status as any;
        entity.metadata = { ...entity.metadata, ...event.metadata };
        await this.subscriptionRepository.save(entity);
        this.logger.log(
          `Subscription ${entity.id} updated: ${event.status}`
        );
      }
    } else {
      entity = this.subscriptionRepository.create({
        provider: event.provider,
        providerSubscriptionId: event.providerSubscriptionId,
        amount: event.amount ?? 0,
        currency: event.currency ?? 'unknown',
        status: (event.status as any) ?? 'pending',
        metadata: event.metadata,
      });
      entity = await this.subscriptionRepository.save(entity);
      this.logger.log(
        `New subscription created from webhook: ${entity.id}`
      );
    }

    return entity;
  }

  // ─── Cancel ─────────────────────────────────────────────────

  async cancel(subscriptionId: string): Promise<SubscriptionEntity> {
    const entity = await this.subscriptionRepository.findOneBy({
      id: subscriptionId,
    });
    if (!entity) throw new NotFoundException('Subscription not found');

    // Idempotent: already canceled
    if (entity.status === 'canceled') {
      return entity;
    }

    const provider = this.getProvider(entity.provider);
    if (!provider.cancelSubscription) {
      throw new BadRequestException(
        `Provider '${provider.id}' does not support subscription cancellation`
      );
    }

    if (!entity.providerSubscriptionId) {
      throw new BadRequestException('Subscription has no provider reference');
    }
    await provider.cancelSubscription(entity.providerSubscriptionId);

    entity.status = 'canceled';
    entity.cancelAtPeriodEnd = false;
    await this.subscriptionRepository.save(entity);

    this.logger.log(`Subscription canceled: ${entity.id}`);

    return entity;
  }

  // ─── Queries ────────────────────────────────────────────────

  async findOne(id: string): Promise<SubscriptionEntity> {
    const entity = await this.subscriptionRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException('Subscription not found');
    return entity;
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    provider?: string;
    status?: string;
  }): Promise<{
    data: SubscriptionEntity[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const where: Record<string, string> = {};
    if (query?.provider) where.provider = query.provider;
    if (query?.status) where.status = query.status;

    const [data, total] = await this.subscriptionRepository.findAndCount({
      where: Object.keys(where).length > 0 ? where : undefined,
      order: { [orderBy]: orderDirection },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  async findMine(
    userId: string,
    query?: {
      page?: number;
      limit?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      status?: string;
    }
  ): Promise<{
    data: SubscriptionEntity[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const where: Record<string, string> = { userId };
    if (query?.status) where.status = query.status;

    const [data, total] = await this.subscriptionRepository.findAndCount({
      where,
      order: { [orderBy]: orderDirection },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private getProvider(providerId: string) {
    const provider = this.options.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw new BadRequestException(`Unknown payment provider: ${providerId}`);
    }
    return provider;
  }

  private isValidTransition(current: string, next: string): boolean {
    return VALID_SUBSCRIPTION_TRANSITIONS[current]?.includes(next) ?? false;
  }
}
