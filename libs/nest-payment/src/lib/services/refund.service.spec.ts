import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RefundService } from './refund.service';
import { RefundEntity } from '../entities/refund.entity';
import { PaymentEntity } from '../entities/payment.entity';
import { PAYMENT_OPTIONS } from '../constants';
import type { NestPaymentOptions } from '../interfaces/nest-payment-options.interface';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';

describe('RefundService', () => {
  let service: RefundService;
  let refundRepository: any;
  let paymentRepository: any;
  let provider: jest.Mocked<PaymentProvider>;

  const mockPaymentEntity = (): PaymentEntity => {
    const entity = new PaymentEntity();
    entity.id = '00000000-0000-0000-0000-000000000001';
    entity.provider = 'test-provider';
    entity.providerPaymentId = 'prov-pay-123';
    entity.amount = 200;
    entity.currency = 'ETB';
    entity.status = 'succeeded';
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  };

  const mockRefundEntity = (): RefundEntity => {
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
    return entity;
  };

  const mockOptions: NestPaymentOptions = {
    providers: [],
  };

  beforeEach(async () => {
    provider = {
      id: 'test-provider',
      createCheckoutSession: jest.fn(),
      createRefund: jest.fn().mockResolvedValue({
        providerReference: 'prov-ref-789',
        providerRefundId: 'prov-ref-789',
        status: 'succeeded',
      }),
      parseWebhookEvent: jest.fn(),
    };

    mockOptions.providers = [provider];

    refundRepository = {
      create: jest.fn().mockImplementation((dto) => ({
        ...mockRefundEntity(),
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...mockRefundEntity(), ...entity })
      ),
      findOneBy: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      remove: jest.fn(),
    };

    paymentRepository = {
      findOneBy: jest.fn(),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...mockPaymentEntity(), ...entity })
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: getRepositoryToken(RefundEntity), useValue: refundRepository },
        { provide: getRepositoryToken(PaymentEntity), useValue: paymentRepository },
        { provide: PAYMENT_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create refund and call provider', async () => {
      paymentRepository.findOneBy.mockResolvedValue(mockPaymentEntity());
      refundRepository.findOneBy.mockResolvedValue(null);

      const result = await service.create({
        paymentId: '00000000-0000-0000-0000-000000000001',
        amount: 50,
        reason: 'Customer request',
      });

      expect(result.refund).toBeDefined();
      expect(provider.createRefund).toHaveBeenCalled();
    });

    it('should throw for non-succeeded payment', async () => {
      const payment = mockPaymentEntity();
      payment.status = 'pending';
      paymentRepository.findOneBy.mockResolvedValue(payment);

      await expect(
        service.create({
          paymentId: '00000000-0000-0000-0000-000000000001',
          amount: 50,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for over-refund', async () => {
      paymentRepository.findOneBy.mockResolvedValue(mockPaymentEntity());
      const existingRefund = mockRefundEntity();
      existingRefund.amount = 180;
      refundRepository.find.mockResolvedValue([existingRefund]);

      await expect(
        service.create({
          paymentId: '00000000-0000-0000-0000-000000000001',
          amount: 50,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing for duplicate idempotencyKey', async () => {
      const existing = mockRefundEntity();
      existing.idempotencyKey = 'idem-1';
      refundRepository.findOneBy.mockResolvedValue(existing);

      const result = await service.create({
        paymentId: '00000000-0000-0000-0000-000000000001',
        amount: 50,
        idempotencyKey: 'idem-1',
      });

      expect(result.refund.id).toBe(existing.id);
      expect(provider.createRefund).not.toHaveBeenCalled();
    });

    it('should throw if provider does not support refunds', async () => {
      paymentRepository.findOneBy.mockResolvedValue(mockPaymentEntity());
      refundRepository.findOneBy.mockResolvedValue(null);
      provider.createRefund = undefined;

      await expect(
        service.create({
          paymentId: '00000000-0000-0000-0000-000000000001',
          amount: 50,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return refund by id', async () => {
      const entity = mockRefundEntity();
      refundRepository.findOneBy.mockResolvedValue(entity);

      const result = await service.findOne(entity.id);
      expect(result.id).toBe(entity.id);
    });

    it('should throw NotFoundException for invalid id', async () => {
      refundRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
