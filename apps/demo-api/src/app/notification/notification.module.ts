import { Module } from '@nestjs/common';
import { NestNotificationModule } from '@nest-util/nest-notification';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    NestNotificationModule.forRoot({
      mail: {
        host: process.env.MAIL_HOST ?? 'smtp.ethereal.email',
        port: Number(process.env.MAIL_PORT ?? 587),
        secure: (process.env.MAIL_SECURE ?? 'false') === 'true',
        auth: {
          user: process.env.MAIL_USER ?? '',
          pass: process.env.MAIL_PASS ?? '',
        },
        from: process.env.MAIL_FROM ?? '"Demo API" <no-reply@demo.local>',
      },
      webhook: {
        secret: process.env.WEBHOOK_SECRET,
        timeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS ?? 5000),
      },
    }),
  ],
  controllers: [NotificationController],
})
export class NotificationModule {}
