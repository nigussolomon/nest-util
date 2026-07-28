import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { PAYMENT_OPTIONS } from '../constants';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let repository: any;
  let provider: jest.Mocked<PaymentProvider>;

  const mockSubscriptionEntity = (): SubscriptionEntity => {
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
    return entity;
  };

  const mockOptions: NestPaymentOptions = {
    providers: [],
  };

  beforeEach(async () => {
    provider = {
      id: 'test-provider',
      createCheckoutSession: jest.fn(),
      createSubscription: jest.fn().mockResolvedValue({
        providerReference: 'prov-sub-456',
        providerSubscriptionId: 'prov-sub-456',
        status: 'active',
      }),
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
      parseWebhookEvent: jest.fn(),
    };

    mockOptions.providers = [provider];

    repository = {
      create: jest.fn().mockImplementation((dto) => ({
        ...mockSubscriptionEntity(),
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...mockSubscriptionEntity(), ...entity })
      ),
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(SubscriptionEntity),
          useValue: repository,
        },
        { provide: PAYMENT_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create subscription and call provider', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.create('user-1', {
        amount: 100,
        currency: 'ETB',
        customerEmail: 'test@example.com',
        interval: 'monthly',
      });

      expect(result.subscription).toBeDefined();
      expect(provider.createSubscription).toHaveBeenCalled();
    });

    it('should return existing for duplicate idempotencyKey', async () => {
      const existing = mockSubscriptionEntity();
      existing.idempotencyKey = 'idem-1';
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.create('user-1', {
        amount: 100,
        currency: 'ETB',
        customerEmail: 'test@example.com',
        interval: 'monthly',
        idempotencyKey: 'idem-1',
      });

      expect(result.subscription.id).toBe(existing.id);
      expect(provider.createSubscription).not.toHaveBeenCalled();
    });

    it('should throw if provider does not support subscriptions', async () => {
      provider.createSubscription = undefined;

      await expect(
        service.create('user-1', {
          amount: 100,
          currency: 'ETB',
          customerEmail: 'test@example.com',
          interval: 'monthly',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel subscription', async () => {
      const entity = mockSubscriptionEntity();
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.cancel(entity.id);

      expect(result.status).toBe('canceled');
      expect(provider.cancelSubscription).toHaveBeenCalledWith(
        'prov-sub-456'
      );
    });

    it('should be idempotent for already canceled', async () => {
      const entity = mockSubscriptionEntity();
      entity.status = 'canceled';
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.cancel(entity.id);

      expect(result.status).toBe('canceled');
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid id', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(service.cancel('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findOne', () => {
    it('should return subscription by id', async () => {
      const entity = mockSubscriptionEntity();
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
});
