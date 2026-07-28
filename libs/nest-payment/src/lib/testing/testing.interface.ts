import type { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment.entity';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { RefundEntity } from '../entities/refund.entity';
import type { PaymentService } from '../services/payment.service';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';

// ─── Test Configs ─────────────────────────────────────────────

export interface PaymentServiceTestConfig {
  serviceClass: new (...args: any[]) => PaymentService;
  options?: Partial<NestPaymentOptions>;
  test?: {
    checkoutPayload?: Partial<import('../dtos/create-checkout.dto').CreateCheckoutDto>;
  };
}

export interface PaymentControllerTestConfig {
  controllerClass: new (...args: any[]) => any;
  options?: Partial<NestPaymentOptions>;
}

// ─── Mock Factories ───────────────────────────────────────────

export function createMockPaymentEntity(
  overrides?: Partial<PaymentEntity>
): PaymentEntity {
  const entity = new PaymentEntity();
  entity.id = '00000000-0000-0000-0000-000000000001';
  entity.provider = 'test-provider';
  entity.providerPaymentId = 'prov-pay-123';
  entity.orderId = 'order-1';
  entity.userId = 'user-1';
  entity.amount = 200;
  entity.currency = 'ETB';
  entity.status = 'succeeded';
  entity.description = 'Test payment';
  entity.customerEmail = 'test@example.com';
  entity.idempotencyKey = undefined;
  entity.metadata = undefined;
  entity.createdAt = new Date();
  entity.updatedAt = new Date();
  if (overrides) Object.assign(entity, overrides);
  return entity;
}

export function createMockSubscriptionEntity(
  overrides?: Partial<SubscriptionEntity>
): SubscriptionEntity {
  const entity = new SubscriptionEntity();
  entity.id = '00000000-0000-0000-0000-000000000002';
  entity.provider = 'test-provider';
  entity.providerSubscriptionId = 'prov-sub-456';
  entity.userId = 'user-1';
  entity.amount = 100;
  entity.currency = 'ETB';
  entity.status = 'active';
  entity.interval = 'monthly';
  entity.intervalCount = 1;
  entity.cancelAtPeriodEnd = false;
  entity.createdAt = new Date();
  entity.updatedAt = new Date();
  if (overrides) Object.assign(entity, overrides);
  return entity;
}

export function createMockRefundEntity(
  overrides?: Partial<RefundEntity>
): RefundEntity {
  const entity = new RefundEntity();
  entity.id = '00000000-0000-0000-0000-000000000003';
  entity.provider = 'test-provider';
  entity.providerRefundId = 'prov-ref-789';
  entity.paymentId = '00000000-0000-0000-0000-000000000001';
  entity.providerPaymentId = 'prov-pay-123';
  entity.amount = 50;
  entity.currency = 'ETB';
  entity.status = 'succeeded';
  entity.reason = 'Customer request';
  entity.createdAt = new Date();
  entity.updatedAt = new Date();
  if (overrides) Object.assign(entity, overrides);
  return entity;
}

export function createMockPaymentProvider(): jest.Mocked<PaymentProvider> {
  return {
    id: 'test-provider',
    createCheckoutSession: jest.fn().mockResolvedValue({
      providerReference: 'prov-pay-123',
      checkoutUrl: 'https://checkout.example.com/pay',
      providerPaymentId: 'prov-pay-123',
    }),
    createSubscription: jest.fn().mockResolvedValue({
      providerReference: 'prov-sub-456',
      providerSubscriptionId: 'prov-sub-456',
      status: 'active',
    }),
    cancelSubscription: jest.fn().mockResolvedValue(undefined),
    createRefund: jest.fn().mockResolvedValue({
      providerReference: 'prov-ref-789',
      providerRefundId: 'prov-ref-789',
      status: 'succeeded',
    }),
    parseWebhookEvent: jest.fn().mockResolvedValue({
      provider: 'test-provider',
      type: 'payment.succeeded',
      providerPaymentId: 'prov-pay-123',
      status: 'succeeded',
      amount: 200,
      currency: 'ETB',
    }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    getPaymentStatus: jest.fn().mockResolvedValue('succeeded'),
  } as unknown as jest.Mocked<PaymentProvider>;
}

export function createMockPaymentRepository(): jest.Mocked<
  Repository<PaymentEntity>
> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity) =>
      Promise.resolve({ ...createMockPaymentEntity(), ...entity })
    ),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((entity) => ({
      ...createMockPaymentEntity(),
      ...entity,
    })),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    metadata: { name: 'PaymentEntity', columns: [] },
  } as unknown as jest.Mocked<Repository<PaymentEntity>>;
}

export function createMockSubscriptionRepository(): jest.Mocked<
  Repository<SubscriptionEntity>
> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity) =>
      Promise.resolve({ ...createMockSubscriptionEntity(), ...entity })
    ),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((entity) => ({
      ...createMockSubscriptionEntity(),
      ...entity,
    })),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    metadata: { name: 'SubscriptionEntity', columns: [] },
  } as unknown as jest.Mocked<Repository<SubscriptionEntity>>;
}

export function createMockRefundRepository(): jest.Mocked<
  Repository<RefundEntity>
> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity) =>
      Promise.resolve({ ...createMockRefundEntity(), ...entity })
    ),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((entity) => ({
      ...createMockRefundEntity(),
      ...entity,
    })),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    metadata: { name: 'RefundEntity', columns: [] },
  } as unknown as jest.Mocked<Repository<RefundEntity>>;
}
