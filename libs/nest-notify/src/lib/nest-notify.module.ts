import {
  DynamicModule,
  Module,
  Controller,
  UseGuards,
  type Type,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTokenEntity } from './entities/device-token.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NOTIFY_OPTIONS } from './constants';
import type { NestNotifyOptions } from './interfaces/nest-notify-options.interface';
import { FcmService } from './services/fcm.service';
import { EmailService } from './services/email.service';
import { NotifyService } from './services/notify.service';
import { CreateNotifyController } from './controllers/notify.controller';
import { JwtAuthGuard, PermissionsGuard } from '@nest-util/nest-auth';

function buildNotifyController(
  options: NestNotifyOptions
): Type<unknown> | undefined {
  const ctrl = options.controller;
  if (ctrl?.enable === false) {
    return undefined;
  }

  const path = ctrl?.path ?? 'notify';
  const ControllerBase = CreateNotifyController({
    permissions: ctrl?.permissions,
  });

  @Controller(path)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  class AutoNotifyController extends ControllerBase {
    constructor(notifyService: NotifyService) {
      super(notifyService);
    }
  }

  return AutoNotifyController;
}

@Module({})
export class NestNotifyModule {
  static forRoot(options: NestNotifyOptions): DynamicModule {
    const NotifyController = buildNotifyController(options);

    return {
      module: NestNotifyModule,
      imports: [TypeOrmModule.forFeature([DeviceTokenEntity, NotificationEntity])],
      controllers: NotifyController ? [NotifyController] : [],
      providers: [
        { provide: NOTIFY_OPTIONS, useValue: options },
        FcmService,
        EmailService,
        NotifyService,
      ],
      exports: [FcmService, EmailService, NotifyService, NOTIFY_OPTIONS],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => NestNotifyOptions | Promise<NestNotifyOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: NestNotifyModule,
      imports: [TypeOrmModule.forFeature([DeviceTokenEntity, NotificationEntity])],
      providers: [
        {
          provide: NOTIFY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        FcmService,
        EmailService,
        NotifyService,
      ],
      exports: [FcmService, EmailService, NotifyService, NOTIFY_OPTIONS],
      global: true,
    };
  }
}
