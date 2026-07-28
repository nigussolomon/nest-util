import {
  CreatePaymentController,
  AUTH_PERMISSIONS_METADATA_KEY,
} from './payment.controller';

describe('PaymentController', () => {
  let controller: any;
  let paymentService: any;
  let subscriptionService: any;
  let refundService: any;

  beforeEach(() => {
    paymentService = {
      createCheckout: jest.fn(),
      handleWebhook: jest.fn(),
      findAll: jest.fn(),
      findMine: jest.fn(),
      findOne: jest.fn(),
      reconcileStalePayments: jest.fn(),
      getProvider: jest.fn(),
    };

    subscriptionService = {
      create: jest.fn(),
      handleWebhook: jest.fn(),
      findAll: jest.fn(),
      cancel: jest.fn(),
    };

    refundService = {
      create: jest.fn(),
      handleWebhook: jest.fn(),
      findAll: jest.fn(),
    };

    const ControllerClass = CreatePaymentController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    controller = new (ControllerClass as any)(
      paymentService,
      subscriptionService,
      refundService
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCheckout', () => {
    it('should call paymentService.createCheckout', async () => {
      const dto = {
        amount: 200,
        currency: 'ETB',
        customerEmail: 'test@example.com',
      };
      const expected = {
        payment: { id: 'pay-1' },
        checkoutUrl: 'https://checkout.example.com',
      };

      paymentService.createCheckout.mockResolvedValue(expected);

      const result = await controller.createCheckout(dto, { id: 'user-1' });

      expect(result).toEqual(expected);
      expect(paymentService.createCheckout).toHaveBeenCalledWith(
        'user-1',
        dto
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      const payments = [{ id: 'pay-1' }];
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
      const payments = [{ id: 'pay-1' }];
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
      const payment = { id: 'pay-1' };
      paymentService.findOne.mockResolvedValue(payment);

      const result = await controller.findOne('pay-1');

      expect(result).toEqual(payment);
    });
  });

  describe('createRefund', () => {
    it('should call refundService.create', async () => {
      const dto = { amount: 50, reason: 'test' };
      const expected = { refund: { id: 'ref-1' } };

      refundService.create.mockResolvedValue(expected);

      const result = await controller.createRefund('pay-1', dto);

      expect(result).toEqual(expected);
      expect(refundService.create).toHaveBeenCalledWith({
        ...dto,
        paymentId: 'pay-1',
      });
    });
  });

  describe('createSubscription', () => {
    it('should call subscriptionService.create', async () => {
      const dto = {
        amount: 100,
        currency: 'ETB',
        customerEmail: 'test@example.com',
        interval: 'monthly',
      };
      const expected = { subscription: { id: 'sub-1' } };

      subscriptionService.create.mockResolvedValue(expected);

      const result = await controller.createSubscription(dto, { id: 'user-1' });

      expect(result).toEqual(expected);
      expect(subscriptionService.create).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('cancelSubscription', () => {
    it('should call subscriptionService.cancel', async () => {
      const expected = { subscription: { id: 'sub-1', status: 'canceled' } };

      subscriptionService.cancel.mockResolvedValue(expected);

      const result = await controller.cancelSubscription('sub-1');

      expect(result).toEqual(expected);
      expect(subscriptionService.cancel).toHaveBeenCalledWith('sub-1');
    });
  });

  describe('permissions', () => {
    it('should not have permission metadata when not configured', () => {
      const checkoutPerm = Reflect.getMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        controller.createCheckout
      );

      expect(checkoutPerm).toBeUndefined();
    });

    it('should have permission metadata when configured', () => {
      const ControllerWithPerms = CreatePaymentController({
        permissions: {
          checkout: 'payments.checkout',
          list: 'payments.read',
          refund: 'payments.refund',
          subscriptions: 'payments.subscriptions',
          reconcile: 'payments.reconcile',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctrl = new (ControllerWithPerms as any)(
        paymentService,
        subscriptionService,
        refundService
      );

      expect(
        Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          ctrl.createCheckout
        )
      ).toEqual(['payments.checkout']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.findAll)
      ).toEqual(['payments.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.findMine)
      ).toEqual(['payments.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.findOne)
      ).toEqual(['payments.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.createRefund)
      ).toEqual(['payments.refund']);
      expect(
        Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          ctrl.createSubscription
        )
      ).toEqual(['payments.subscriptions']);
      expect(
        Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          ctrl.cancelSubscription
        )
      ).toEqual(['payments.subscriptions']);
      expect(
        Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          ctrl.reconcile
        )
      ).toEqual(['payments.reconcile']);
    });
  });
});
