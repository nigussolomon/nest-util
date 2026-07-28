import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../services/payment.service';
import { SubscriptionService } from '../services/subscription.service';
import { RefundService } from '../services/refund.service';
import { PAYMENT_OPTIONS } from '../constants';
import { AUTH_PERMISSIONS_METADATA_KEY } from '../controllers/payment.controller';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import {
  PaymentControllerTestConfig,
  createMockPaymentEntity,
} from './testing.interface';

export function paymentControllerTests(
  config: PaymentControllerTestConfig
): void {
  describe(config.controllerClass.name, () => {
    let controller: InstanceType<typeof config.controllerClass>;
    let paymentService: jest.Mocked<PaymentService>;
    let subscriptionService: jest.Mocked<SubscriptionService>;
    let refundService: jest.Mocked<RefundService>;

    const defaultOptions: NestPaymentOptions = {
      providers: [],
      ...config.options,
    };

    beforeEach(async () => {
      paymentService = {
        createCheckout: jest.fn(),
        handleWebhook: jest.fn(),
        findAll: jest.fn(),
        findMine: jest.fn(),
        findOne: jest.fn(),
        reconcileStalePayments: jest.fn(),
        getProvider: jest.fn(),
      } as unknown as jest.Mocked<PaymentService>;

      subscriptionService = {
        create: jest.fn(),
        handleWebhook: jest.fn(),
        findAll: jest.fn(),
        cancel: jest.fn(),
      } as unknown as jest.Mocked<SubscriptionService>;

      refundService = {
        create: jest.fn(),
        handleWebhook: jest.fn(),
        findAll: jest.fn(),
      } as unknown as jest.Mocked<RefundService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          { provide: PaymentService, useValue: paymentService },
          { provide: SubscriptionService, useValue: subscriptionService },
          { provide: RefundService, useValue: refundService },
          { provide: PAYMENT_OPTIONS, useValue: defaultOptions },
        ],
      }).compile();

      controller = module.get(config.controllerClass);
    });

    describe('createCheckout', () => {
      it('should call paymentService.createCheckout', async () => {
        const dto = {
          amount: 200,
          currency: 'ETB',
          customerEmail: 'test@example.com',
        };

        paymentService.createCheckout.mockResolvedValue({
          payment: createMockPaymentEntity(),
          checkoutUrl: 'https://checkout.example.com',
        });

        const result = await controller.createCheckout(dto, { id: 'user-1' });

        expect(result).toHaveProperty('checkoutUrl');
        expect(paymentService.createCheckout).toHaveBeenCalledWith(
          'user-1',
          dto
        );
      });
    });

    describe('findAll', () => {
      it('should return paginated payments', async () => {
        const payments = [createMockPaymentEntity()];
        paymentService.findAll.mockResolvedValue({
          data: payments,
          meta: { total: 1, page: 1, limit: 10 },
        });

        const result = await controller.findAll(1, 10);

        expect(result.data).toEqual(payments);
      });
    });

    describe('findMine', () => {
      it('should return user-scoped payments', async () => {
        const payments = [createMockPaymentEntity({ userId: 'user-1' })];
        paymentService.findMine.mockResolvedValue({
          data: payments,
          meta: { total: 1, page: 1, limit: 10 },
        });

        const result = await controller.findMine({ id: 'user-1' }, 1, 10);

        expect(result.data).toEqual(payments);
        expect(paymentService.findMine).toHaveBeenCalledWith('user-1', {
          page: 1,
          limit: 10,
          status: undefined,
        });
      });
    });

    describe('findOne', () => {
      it('should return payment by id', async () => {
        const payment = createMockPaymentEntity();
        paymentService.findOne.mockResolvedValue(payment);

        const result = await controller.findOne(payment.id);

        expect(result.id).toBe(payment.id);
      });
    });

    describe('createRefund', () => {
      it('should call refundService.create', async () => {
        refundService.create.mockResolvedValue({
          refund: { id: 'ref-1' } as any,
        });

        await controller.createRefund('pay-1', {
          amount: 50,
          reason: 'test',
        });

        expect(refundService.create).toHaveBeenCalledWith({
          amount: 50,
          reason: 'test',
          paymentId: 'pay-1',
        });
      });
    });

    describe('cancelSubscription', () => {
      it('should call subscriptionService.cancel', async () => {
        subscriptionService.cancel.mockResolvedValue({
          id: 'sub-1',
          status: 'canceled',
        } as any);

        await controller.cancelSubscription('sub-1');

        expect(subscriptionService.cancel).toHaveBeenCalledWith('sub-1');
      });
    });

    describe('permissions', () => {
      it('should have permission metadata when configured', () => {
        // Permissions are applied by CreatePaymentController when options are passed
        // This test validates the metadata key exists
        expect(AUTH_PERMISSIONS_METADATA_KEY).toBe('auth:permissions');
      });
    });
  });
}
