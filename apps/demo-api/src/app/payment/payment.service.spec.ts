import { PaymentService } from '@nest-util/nest-payment';
import { paymentServiceTests } from '@nest-util/nest-payment/testing';

paymentServiceTests({
  serviceClass: PaymentService,
  test: {
    checkoutPayload: {
      amount: 500,
      currency: 'ETB',
      customerEmail: 'buyer@example.com',
      customerName: 'John',
      customerLastName: 'Doe',
    },
  },
});
