import { Module } from '@nestjs/common';
import { NestPaymentModule } from '@nest-util/nest-payment';
import { ChapaProvider } from './chapa.provider';

const chapaProvider = new ChapaProvider(process.env.CHAPA_SECRET_KEY ?? '');

@Module({
  imports: [
    NestPaymentModule.forRoot({
      providers: [chapaProvider],
      controller: {
        path: 'payments',
        permissions: {
          checkout: 'payments.create',
          list: 'payments.read',
          reconcile: 'payments.reconcile',
        },
      },
    }),
  ],
})
export class PaymentModule {}
