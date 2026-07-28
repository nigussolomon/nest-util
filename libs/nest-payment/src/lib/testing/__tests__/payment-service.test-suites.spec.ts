import { PaymentService } from '../../services/payment.service';
import { PaymentEntity } from '../../entities/payment.entity';
import { paymentServiceTests } from '../payment-service.test-suites';

paymentServiceTests({
  serviceClass: PaymentService,
  entity: PaymentEntity,
  test: {
    checkoutPayload: {
      amount: 200,
      currency: 'ETB',
      customerEmail: 'test@example.com',
    },
  },
});
