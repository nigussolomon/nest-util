import { PaymentService } from '../../services/payment.service';
import { paymentServiceTests } from '../payment-service.test-suites';

paymentServiceTests({
  serviceClass: PaymentService,
  test: {
    checkoutPayload: {
      amount: 200,
      currency: 'ETB',
      customerEmail: 'test@example.com',
    },
  },
});
