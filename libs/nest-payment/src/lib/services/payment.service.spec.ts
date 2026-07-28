import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentEntity } from '../entities/payment.entity';
import { PAYMENT_OPTIONS } from '../constants';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';

describe('PaymentService', () => {
  let service: PaymentService;
  let repository: any;
  let provider: jest.Mocked<PaymentProvider>;

  const mockPaymentEntity = (): PaymentEntity => {
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
    return entity;
  };

  const mockOptions: NestPaymentOptions = {
    providers: [],
    reconciliation: { enable: true, staleAfterMs: 600000 },
  };

  beforeEach(async () => {
    provider = {
      id: 'test-provider',
      createCheckoutSession: jest.fn().mockResolvedValue({
        providerReference: 'prov-pay-123',
        checkoutUrl: 'https://checkout.example.com/pay',
        providerPaymentId: 'prov-pay-123',
      }),
      parseWebhookEvent: jest.fn(),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      getPaymentStatus: jest.fn().mockResolvedValue('succeeded'),
    };

    mockOptions.providers = [provider];

    repository = {
      create: jest.fn().mockImplementation((dto) => ({
        ...mockPaymentEntity(),
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...mockPaymentEntity(), ...entity })
      ),
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(PaymentEntity), useValue: repository },
        { provide: PAYMENT_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckout', () => {
    it('should create pending payment and call provider', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.createCheckout('user-1', {
        amount: 200,
        currency: 'ETB',
        customerEmail: 'test@example.com',
      });

      expect(result.payment).toBeDefined();
      expect(result.checkoutUrl).toBe('https://checkout.example.com/pay');
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(provider.createCheckoutSession).toHaveBeenCalled();
    });

    it('should return existing payment for duplicate idempotencyKey', async () => {
      const existing = mockPaymentEntity();
      existing.idempotencyKey = 'idem-1';
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.createCheckout('user-1', {
        amount: 200,
        currency: 'ETB',
        customerEmail: 'test@example.com',
        idempotencyKey: 'idem-1',
      });

      expect(result.payment.id).toBe(existing.id);
      expect(provider.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should handle provider failure gracefully', async () => {
      repository.findOneBy.mockResolvedValue(null);
      provider.createCheckoutSession.mockRejectedValue(
        new Error('Provider timeout')
      );

      const result = await service.createCheckout('user-1', {
        amount: 200,
        currency: 'ETB',
        customerEmail: 'test@example.com',
      });

      expect(result.payment).toBeDefined();
      expect(result.error).toBe('Provider timeout');
      expect(result.payment.status).toBe('pending');
    });
  });

  describe('handleWebhook', () => {
    it('should create new payment from webhook event', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.handleWebhook({
        provider: 'test-provider',
        type: 'payment.succeeded',
        providerPaymentId: 'prov-new-123',
        status: 'succeeded',
        amount: 200,
        currency: 'ETB',
      });

      expect(result).toBeDefined();
      expect(repository.create).toHaveBeenCalled();
    });

    it('should update existing payment on forward transition', async () => {
      const existing = mockPaymentEntity();
      existing.status = 'pending';
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.handleWebhook({
        provider: 'test-provider',
        type: 'payment.succeeded',
        providerPaymentId: 'prov-pay-123',
        status: 'succeeded',
      });

      expect(result.status).toBe('succeeded');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should ignore backward transitions', async () => {
      const existing = mockPaymentEntity();
      existing.status = 'succeeded';
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.handleWebhook({
        provider: 'test-provider',
        type: 'payment.pending',
        providerPaymentId: 'prov-pay-123',
        status: 'pending',
      });

      expect(result.status).toBe('succeeded');
    });
  });

  describe('findOne', () => {
    it('should return payment by id', async () => {
      const entity = mockPaymentEntity();
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.findOne(entity.id);
      expect(result.id).toBe(entity.id);
    });

    it('should throw NotFoundException for invalid id', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      const payments = [mockPaymentEntity()];
      repository.findAndCount.mockResolvedValue([payments, 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(payments);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
    });
  });

  describe('findMine', () => {
    it('should return user-scoped payments', async () => {
      const payments = [mockPaymentEntity()];
      repository.findAndCount.mockResolvedValue([payments, 1]);

      const result = await service.findMine('user-1', { page: 1, limit: 10 });

      expect(result.data).toEqual(payments);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
    });
  });

  describe('reconcileStalePayments', () => {
    it('should check stale payments against provider', async () => {
      const stale = mockPaymentEntity();
      stale.status = 'pending';
      repository.find.mockResolvedValue([stale]);

      const result = await service.reconcileStalePayments();

      expect(result.checked).toBe(1);
      expect(provider.getPaymentStatus).toHaveBeenCalledWith('prov-pay-123');
    });

    it('should throw when reconciliation is disabled', async () => {
      mockOptions.reconciliation = { enable: false };

      await expect(service.reconcileStalePayments()).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getProvider', () => {
    it('should return provider by id', () => {
      const result = service.getProvider('test-provider');
      expect(result.id).toBe('test-provider');
    });

    it('should throw for unknown provider', () => {
      expect(() => service.getProvider('unknown')).toThrow(
        BadRequestException
      );
    });
  });
});
