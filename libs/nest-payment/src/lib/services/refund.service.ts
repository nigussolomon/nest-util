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
import { PaymentEntity } from '../entities/payment.entity';
import { RefundEntity } from '../entities/refund.entity';
import type { CreateRefundDto } from '../dtos/create-refund.dto';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @Inject(PAYMENT_OPTIONS)
    private readonly options: NestPaymentOptions,
    @InjectRepository(RefundEntity)
    private readonly refundRepository: Repository<RefundEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>
  ) {}

  // ─── Create ─────────────────────────────────────────────────

  async create(
    dto: CreateRefundDto
  ): Promise<{ refund: RefundEntity; error?: string }> {
    // Idempotency: check for existing refund with same key
    if (dto.idempotencyKey) {
      const existing = await this.refundRepository.findOneBy({
        idempotencyKey: dto.idempotencyKey,
      });
      if (existing) {
        this.logger.log(
          `Idempotent refund: returning existing ${existing.id}`
        );
        return { refund: existing };
      }
    }

    // Find parent payment
    const payment = await this.paymentRepository.findOneBy({
      id: dto.paymentId,
    });
    if (!payment) {
      throw new NotFoundException('Parent payment not found');
    }
    if (payment.status !== 'succeeded') {
      throw new BadRequestException(
        `Cannot refund payment with status '${payment.status}'. Only 'succeeded' payments can be refunded.`
      );
    }

    // Calculate already-refunded total
    const existingRefunds = await this.refundRepository.find({
      where: { paymentId: dto.paymentId, status: 'succeeded' as any },
    });
    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    );

    const refundAmount = dto.amount ?? Number(payment.amount);

    if (totalRefunded + refundAmount > Number(payment.amount)) {
      throw new BadRequestException(
        `Refund amount (${refundAmount}) plus already refunded (${totalRefunded}) exceeds payment amount (${payment.amount})`
      );
    }

    // Create DB record
    const entity = this.refundRepository.create({
      provider: dto.provider ?? payment.provider,
      providerRefundId: '',
      paymentId: dto.paymentId,
      providerPaymentId: payment.providerPaymentId,
      amount: refundAmount,
      currency: payment.currency,
      reason: dto.reason,
      status: 'pending',
      idempotencyKey: dto.idempotencyKey,
    });

    const saved = await this.refundRepository.save(entity);

    // Resolve provider
    const provider = this.getProvider(saved.provider);
    if (!provider.createRefund) {
      throw new BadRequestException(
        `Provider '${provider.id}' does not support refunds`
      );
    }

    try {
      const result = await provider.createRefund({
        providerPaymentId: payment.providerPaymentId,
        amount: refundAmount,
        reason: dto.reason,
        idempotencyKey: dto.idempotencyKey,
        metadata: { refundId: saved.id },
      });

      saved.providerRefundId = result.providerRefundId;
      saved.status = result.status === 'succeeded' ? 'succeeded' : result.status as any;
      saved.metadata = result.metadata;

      const updated = await this.refundRepository.save(saved);

      // Update parent payment status if fully refunded
      const newTotalRefunded = totalRefunded + refundAmount;
      if (newTotalRefunded >= Number(payment.amount)) {
        payment.status = 'refunded';
        await this.paymentRepository.save(payment);
      }

      this.logger.log(
        `Refund created: ${updated.id} → ${updated.providerRefundId}`
      );

      return { refund: updated };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.error(`Refund provider call failed: ${message}`);

      return { refund: saved, error: message };
    }
  }

  // ─── Webhook ────────────────────────────────────────────────

  async handleWebhook(event: WebhookEvent): Promise<RefundEntity | null> {
    if (!event.isRefundEvent || !event.providerRefundId) {
      return null;
    }

    let entity = await this.refundRepository.findOneBy({
      provider: event.provider,
      providerRefundId: event.providerRefundId,
    });

    if (entity) {
      if (event.status === 'succeeded' || event.status === 'failed') {
        entity.status = event.status as any;
        entity.metadata = { ...entity.metadata, ...event.metadata };
        await this.refundRepository.save(entity);
        this.logger.log(
          `Refund ${entity.id} updated: ${event.status}`
        );
      }
    } else {
      // Try to find parent payment
      let paymentId = '';
      if (event.providerPaymentId) {
        const payment = await this.paymentRepository.findOneBy({
          provider: event.provider,
          providerPaymentId: event.providerPaymentId,
        });
        if (payment) paymentId = payment.id;
      }

      entity = this.refundRepository.create({
        provider: event.provider,
        providerRefundId: event.providerRefundId,
        paymentId,
        providerPaymentId: event.providerPaymentId ?? '',
        amount: event.amount ?? 0,
        currency: event.currency ?? 'unknown',
        status: (event.status as any) ?? 'pending',
        metadata: event.metadata,
      });
      entity = await this.refundRepository.save(entity);
      this.logger.log(
        `New refund created from webhook: ${entity.id}`
      );
    }

    return entity;
  }

  // ─── Queries ────────────────────────────────────────────────

  async findOne(id: string): Promise<RefundEntity> {
    const entity = await this.refundRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException('Refund not found');
    return entity;
  }

  async findByPaymentId(paymentId: string): Promise<RefundEntity[]> {
    return this.refundRepository.findBy({ paymentId });
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    provider?: string;
    status?: string;
  }): Promise<{
    data: RefundEntity[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const where: Record<string, string> = {};
    if (query?.provider) where.provider = query.provider;
    if (query?.status) where.status = query.status;

    const [data, total] = await this.refundRepository.findAndCount({
      where: Object.keys(where).length > 0 ? where : undefined,
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
}
