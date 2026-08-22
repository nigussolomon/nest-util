import { keyed, ErrorKey } from '@nest-util/nest-error';
import {
  Inject,
  Injectable,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { PAYMENT_OPTIONS } from '../constants';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';
import type { WebhookEvent } from '../interfaces/payment-webhook.interface';
import { PaymentEntity } from '../entities/payment.entity';
import type { CreateCheckoutDto } from '../dtos/create-checkout.dto';

const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'succeeded', 'failed'],
  processing: ['succeeded', 'failed'],
  succeeded: ['refunded'],
  failed: [],
  refunded: [],
  canceled: [],
};

const RECONCILABLE_STATUSES = ['pending', 'processing', 'succeeded'];

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(PAYMENT_OPTIONS)
    private readonly options: NestPaymentOptions,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>
  ) {}

  // ─── Checkout ───────────────────────────────────────────────

  async createCheckout(
    userId: string,
    dto: CreateCheckoutDto
  ): Promise<{
    payment: PaymentEntity;
    checkoutUrl?: string;
    error?: string;
  }> {
    // Idempotency: check for existing payment with same key
    if (dto.idempotencyKey) {
      const existing = await this.paymentRepository.findOneBy({
        idempotencyKey: dto.idempotencyKey,
      });
      if (existing) {
        this.logger.log(
          `Idempotent checkout: returning existing payment ${existing.id}`
        );
        return { payment: existing, checkoutUrl: existing.metadata?.checkoutUrl as string | undefined };
      }
    }

    // Create DB record first (status: pending)
    const entity = this.paymentRepository.create({
      provider: dto.provider ?? this.options.providers[0]?.id ?? 'unknown',
      providerPaymentId: undefined,
      orderId: dto.orderId,
      userId,
      amount: dto.amount,
      currency: dto.currency,
      status: 'pending',
      description: dto.description,
      customerEmail: dto.customerEmail,
      idempotencyKey: dto.idempotencyKey,
    });

    const saved = await this.paymentRepository.save(entity);

    // Resolve provider
    const provider = this.getProvider(saved.provider);

    try {
      const result = await provider.createCheckoutSession({
        amount: dto.amount,
        currency: dto.currency,
        customerEmail: dto.customerEmail,
        customerName: dto.customerName,
        customerLastName: dto.customerLastName,
        orderId: dto.orderId,
        description: dto.description,
        idempotencyKey: dto.idempotencyKey,
        callbackUrl: dto.callbackUrl,
        returnUrl: dto.returnUrl,
        metadata: { paymentId: saved.id },
      });

      // Update with provider data
      saved.providerPaymentId = result.providerPaymentId ?? result.providerReference;
      saved.status = 'processing';
      saved.metadata = {
        ...saved.metadata,
        ...result.metadata,
        checkoutUrl: result.checkoutUrl,
      };

      const updated = await this.paymentRepository.save(saved);

      this.logger.log(
        `Checkout session created: ${updated.id} → ${updated.providerPaymentId}`
      );

      return { payment: updated, checkoutUrl: result.checkoutUrl };
    } catch (error) {
      // Provider call failed — payment stays 'pending', do NOT mark as failed
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.error(`Checkout provider call failed: ${message}`);

      return { payment: saved, error: message };
    }
  }

  // ─── Webhook ────────────────────────────────────────────────

  async handleWebhook(event: WebhookEvent): Promise<PaymentEntity> {
    let entity: PaymentEntity | null = null;

    // Look up by providerPaymentId
    if (event.providerPaymentId) {
      entity = await this.paymentRepository.findOneBy({
        provider: event.provider,
        providerPaymentId: event.providerPaymentId,
      });
    }

    if (entity) {
      // Update existing payment — only forward transitions
      if (
        event.status &&
        this.isValidForwardTransition(entity.status, event.status)
      ) {
        entity.status = event.status;
        if (event.amount !== undefined) entity.amount = event.amount;
        if (event.currency) entity.currency = event.currency;
        entity.metadata = { ...entity.metadata, ...event.metadata };
        await this.paymentRepository.save(entity);
        this.logger.log(
          `Payment ${entity.id} updated: ${event.status}`
        );
      } else if (event.status) {
        this.logger.log(
          `Ignoring backward transition: ${entity.status} → ${event.status} for payment ${entity.id}`
        );
      }
    } else {
      // Create new payment record from webhook
      entity = this.paymentRepository.create({
        provider: event.provider,
        providerPaymentId: event.providerPaymentId ?? `webhook-${Date.now()}`,
        amount: event.amount ?? 0,
        currency: event.currency ?? 'unknown',
        status: event.status ?? 'pending',
        metadata: event.metadata,
      });
      entity = await this.paymentRepository.save(entity);
      this.logger.log(
        `New payment created from webhook: ${entity.id}`
      );
    }

    return entity;
  }

  // ─── Queries ────────────────────────────────────────────────

  async findOne(id: string): Promise<PaymentEntity> {
    const entity = await this.paymentRepository.findOneBy({ id });
    if (!entity) throw keyed(HttpStatus.NOT_FOUND, ErrorKey.PAYMENT_PAYMENT_NOT_FOUND);
    return entity;
  }

  async findByProviderPaymentId(
    provider: string,
    providerPaymentId: string
  ): Promise<PaymentEntity | null> {
    return this.paymentRepository.findOneBy({ provider, providerPaymentId });
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    provider?: string;
    status?: string;
  }): Promise<{
    data: PaymentEntity[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const where: Record<string, string> = {};
    if (query?.provider) where.provider = query.provider;
    if (query?.status) where.status = query.status;

    const [data, total] = await this.paymentRepository.findAndCount({
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
    data: PaymentEntity[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const where: Record<string, string> = { userId };
    if (query?.status) where.status = query.status;

    const [data, total] = await this.paymentRepository.findAndCount({
      where,
      order: { [orderBy]: orderDirection },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  // ─── Reconciliation ─────────────────────────────────────────

  async reconcilePayment(id: string): Promise<PaymentEntity> {
    if (this.options.reconciliation?.enable === false) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.PAYMENT_RECONCILIATION_DISABLED);
    }

    const payment = await this.paymentRepository.findOneBy({ id });
    if (!payment) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.PAYMENT_PAYMENT_NOT_FOUND);
    }

    if (!RECONCILABLE_STATUSES.includes(payment.status)) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.VALIDATION_FAILED);
    }

    if (!payment.providerPaymentId) {
      payment.status = 'failed';
      payment.metadata = { ...payment.metadata, orphanedReason: 'Payment never reached provider', reconciledAt: new Date().toISOString() };
      await this.paymentRepository.save(payment);
      this.logger.log(`Orphaned payment ${id} marked as failed`);
      return payment;
    }

    const provider = this.getProvider(payment.provider);
    if (!provider.getPaymentStatus) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.PAYMENT_PROVIDER_NOT_CONFIGURED);
    }

    const providerStatus = await provider.getPaymentStatus(payment.providerPaymentId);
    if (!providerStatus) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.PAYMENT_PROVIDER_NOT_CONFIGURED);
    }

    if (providerStatus !== payment.status) {
      if (!this.isValidForwardTransition(payment.status, providerStatus)) {
        throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.PAYMENT_CHECKOUT_FAILED);
      }
      payment.status = providerStatus;
      payment.metadata = { ...payment.metadata, reconciledAt: new Date().toISOString() };
      await this.paymentRepository.save(payment);

      if (this.options.onReconciliationMismatch) {
        await this.options.onReconciliationMismatch(payment, providerStatus);
      }

      this.logger.log(`Reconciled payment ${id}: → ${providerStatus}`);
    }

    return payment;
  }

  async reconcileStalePayments(queryOptions?: {
    staleAfterMs?: number;
  }): Promise<{ checked: number; updated: number; failed: number }> {
    if (this.options.reconciliation?.enable === false) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.PAYMENT_RECONCILIATION_DISABLED);
    }

    const staleAfterMs =
      queryOptions?.staleAfterMs ??
      this.options.reconciliation?.staleAfterMs ??
      600000;

    const staleThreshold = new Date(Date.now() - staleAfterMs);

    const stalePayments = await this.paymentRepository.find({
      where: {
        status: In(RECONCILABLE_STATUSES as any),
        createdAt: LessThanOrEqual(staleThreshold),
      },
    });

    const results = { checked: 0, updated: 0, failed: 0 };

    for (const payment of stalePayments) {
      results.checked++;
      try {
        const provider = this.getProvider(payment.provider);
        if (!provider.getPaymentStatus) continue;

        if (!payment.providerPaymentId) continue;
        const providerStatus = await provider.getPaymentStatus(
          payment.providerPaymentId
        );

        if (providerStatus && providerStatus !== payment.status) {
          if (
            this.isValidForwardTransition(payment.status, providerStatus)
          ) {
            payment.status = providerStatus;
            await this.paymentRepository.save(payment);
            results.updated++;

            this.logger.log(
              `Reconciled payment ${payment.id}: ${payment.status} → ${providerStatus}`
            );

            if (this.options.onReconciliationMismatch) {
              await this.options.onReconciliationMismatch(
                payment,
                providerStatus
              );
            }
          }
        }
      } catch (error) {
        results.failed++;
        this.logger.error(
          `Reconciliation failed for payment ${payment.id}: ${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }

    this.logger.log(
      `Reconciliation complete: ${results.checked} checked, ${results.updated} updated, ${results.failed} failed`
    );

    return results;
  }

  // ─── Helpers ────────────────────────────────────────────────

  getProvider(providerId: string): PaymentProvider {
    const provider = this.options.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.PAYMENT_PROVIDER_NOT_CONFIGURED);
    }
    return provider;
  }

  private isValidForwardTransition(current: string, next: string): boolean {
    return VALID_PAYMENT_TRANSITIONS[current]?.includes(next) ?? false;
  }
}
