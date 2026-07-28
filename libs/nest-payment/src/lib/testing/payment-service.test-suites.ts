import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from '../services/payment.service';
import { PaymentEntity } from '../entities/payment.entity';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { RefundEntity } from '../entities/refund.entity';
import { PAYMENT_OPTIONS } from '../constants';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import {
  PaymentServiceTestConfig,
  createMockPaymentEntity,
  createMockPaymentProvider,
  createMockPaymentRepository,
  createMockSubscriptionRepository,
  createMockRefundRepository,
} from './testing.interface';

export function paymentServiceTests(config: PaymentServiceTestConfig): void {
  describe(config.serviceClass.name, () => {
    let service: PaymentService;
    let paymentRepository: ReturnType<typeof createMockPaymentRepository>;
    let provider: ReturnType<typeof createMockPaymentProvider>;

    const defaultOptions: NestPaymentOptions = {
      providers: [],
      ...config.options,
    };

    beforeEach(async () => {
      paymentRepository = createMockPaymentRepository();
      provider = createMockPaymentProvider();
      defaultOptions.providers = [provider];

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          config.serviceClass,
          {
            provide: getRepositoryToken(PaymentEntity),
            useValue: paymentRepository,
          },
          {
            provide: getRepositoryToken(SubscriptionEntity),
            useValue: createMockSubscriptionRepository(),
          },
          {
            provide: getRepositoryToken(RefundEntity),
            useValue: createMockRefundRepository(),
          },
          { provide: PAYMENT_OPTIONS, useValue: defaultOptions },
        ],
      }).compile();

      service = module.get<PaymentService>(config.serviceClass);
    });

    describe('createCheckout', () => {
      it('should create pending payment and call provider', async () => {
        paymentRepository.findOneBy.mockResolvedValue(null);

        const dto = {
          amount: 200,
          currency: 'ETB',
          customerEmail: 'test@example.com',
          ...config.test?.checkoutPayload,
        };

        const result = await service.createCheckout('user-1', dto);

        expect(result.payment).toBeDefined();
        expect(result.checkoutUrl).toBeDefined();
        expect(paymentRepository.create).toHaveBeenCalled();
        expect(paymentRepository.save).toHaveBeenCalled();
        expect(provider.createCheckoutSession).toHaveBeenCalled();
      });

      it('should return existing payment for duplicate idempotencyKey', async () => {
        const existing = createMockPaymentEntity({
          idempotencyKey: 'idem-1',
        });
        paymentRepository.findOneBy.mockResolvedValue(existing);

        const result = await service.createCheckout('user-1', {
          amount: 200,
          currency: 'ETB',
          customerEmail: 'test@example.com',
          idempotencyKey: 'idem-1',
        });

        expect(result.payment.id).toBe(existing.id);
        expect(provider.createCheckoutSession).not.toHaveBeenCalled();
      });
    });

    describe('handleWebhook', () => {
      it('should create new payment from webhook event', async () => {
        paymentRepository.findOneBy.mockResolvedValue(null);

        const result = await service.handleWebhook({
          provider: 'test-provider',
          type: 'payment.succeeded',
          providerPaymentId: 'prov-new-123',
          status: 'succeeded',
          amount: 200,
          currency: 'ETB',
        });

        expect(result).toBeDefined();
        expect(paymentRepository.create).toHaveBeenCalled();
      });

      it('should update existing payment status on webhook', async () => {
        const existing = createMockPaymentEntity({ status: 'pending' });
        paymentRepository.findOneBy.mockResolvedValue(existing);

        const result = await service.handleWebhook({
          provider: 'test-provider',
          type: 'payment.succeeded',
          providerPaymentId: 'prov-pay-123',
          status: 'succeeded',
        });

        expect(result.status).toBe('succeeded');
        expect(paymentRepository.save).toHaveBeenCalled();
      });
    });

    describe('findOne', () => {
      it('should return payment by id', async () => {
        const entity = createMockPaymentEntity();
        paymentRepository.findOneBy.mockResolvedValue(entity);

        const result = await service.findOne(entity.id);
        expect(result.id).toBe(entity.id);
      });
    });

    describe('reconcileStalePayments', () => {
      it('should check stale payments against provider', async () => {
        const stale = createMockPaymentEntity({ status: 'pending' });
        paymentRepository.find.mockResolvedValue([stale]);

        const result = await service.reconcileStalePayments();

        expect(result.checked).toBe(1);
        expect(provider.getPaymentStatus).toHaveBeenCalledWith(
          'prov-pay-123'
        );
      });
    });
  });
}
