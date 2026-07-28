import { DynamicModule, Module, Controller, UseGuards, type Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { RefundEntity } from './entities/refund.entity';
import { PAYMENT_OPTIONS } from './constants';
import type { NestPaymentOptions } from './interfaces/nest-payment-options.interface';
import { PaymentService } from './services/payment.service';
import { SubscriptionService } from './services/subscription.service';
import { RefundService } from './services/refund.service';
import { CreatePaymentController } from './controllers/payment.controller';
import { JwtAuthGuard, PermissionsGuard } from '@nest-util/nest-auth';

function buildPaymentController(
  options: NestPaymentOptions
): Type<unknown> | undefined {
  const ctrl = options.controller;
  if (ctrl?.enable === false) return undefined;

  const path = ctrl?.path ?? 'payments';
  const ControllerBase = CreatePaymentController({
    permissions: ctrl?.permissions,
  });

  @Controller(path)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  class AutoPaymentController extends ControllerBase {
    constructor(
      paymentService: PaymentService,
      subscriptionService: SubscriptionService,
      refundService: RefundService
    ) {
      super(paymentService, subscriptionService, refundService);
    }
  }

  return AutoPaymentController;
}

@Module({})
export class NestPaymentModule {
  static forRoot(options: NestPaymentOptions): DynamicModule {
    const PaymentController = buildPaymentController(options);

    return {
      module: NestPaymentModule,
      imports: [
        TypeOrmModule.forFeature([
          PaymentEntity,
          SubscriptionEntity,
          RefundEntity,
        ]),
      ],
      controllers: PaymentController ? [PaymentController] : [],
      providers: [
        { provide: PAYMENT_OPTIONS, useValue: options },
        PaymentService,
        SubscriptionService,
        RefundService,
      ],
      exports: [
        PaymentService,
        SubscriptionService,
        RefundService,
        PAYMENT_OPTIONS,
      ],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => NestPaymentOptions | Promise<NestPaymentOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: NestPaymentModule,
      imports: [
        TypeOrmModule.forFeature([
          PaymentEntity,
          SubscriptionEntity,
          RefundEntity,
        ]),
      ],
      providers: [
        {
          provide: PAYMENT_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        PaymentService,
        SubscriptionService,
        RefundService,
      ],
      exports: [
        PaymentService,
        SubscriptionService,
        RefundService,
        PAYMENT_OPTIONS,
      ],
      global: true,
    };
  }
}
