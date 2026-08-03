import { Module } from '@nestjs/common';
import { NestNotifyModule } from '@nest-util/nest-notify';

@Module({
  imports: [
    NestNotifyModule.forRoot({
      fcm: {
        enabled: false,
      },
      smtp: {
        enabled: false,
      },
      controller: {
        path: 'notify',
        permissions: {
          devices: 'notify.devices',
          push: 'notify.push',
          email: 'notify.email',
          history: 'notify.history',
        },
      },
    }),
  ],
})
export class NotifyModule {}
