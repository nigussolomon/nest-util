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
import { NOTIFY_OPTIONS, NOTIFY_GATEWAY } from './constants';
import type { NestNotifyOptions } from './interfaces/nest-notify-options.interface';
import { FcmService } from './services/fcm.service';
import { EmailService } from './services/email.service';
import { NotifyService } from './services/notify.service';
import { CreateNotifyController } from './controllers/notify.controller';
import {
  createNotifyGateway,
  type NotificationsGateway,
} from './notifications.gateway';
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

interface GatewayProvider {
  provide: typeof NOTIFY_GATEWAY;
  useClass: Type<NotificationsGateway>;
}

function buildNotifyGateway(
  options: NestNotifyOptions
): { providers: GatewayProvider[]; exports: (typeof NOTIFY_GATEWAY)[] } {
  if (options.socket?.enable !== true) {
    return { providers: [], exports: [] };
  }
  const Gateway = createNotifyGateway(options);
  return {
    providers: [{ provide: NOTIFY_GATEWAY, useClass: Gateway }],
    exports: [NOTIFY_GATEWAY],
  };
}

@Module({})
export class NestNotifyModule {
  static forRoot(options: NestNotifyOptions): DynamicModule {
    const NotifyController = buildNotifyController(options);
    const gateway = buildNotifyGateway(options);

    return {
      module: NestNotifyModule,
      imports: [TypeOrmModule.forFeature([DeviceTokenEntity, NotificationEntity])],
      controllers: NotifyController ? [NotifyController] : [],
      providers: [
        { provide: NOTIFY_OPTIONS, useValue: options },
        FcmService,
        EmailService,
        NotifyService,
        ...gateway.providers,
      ],
      exports: [
        FcmService,
        EmailService,
        NotifyService,
        NOTIFY_OPTIONS,
        ...gateway.exports,
      ],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => NestNotifyOptions | Promise<NestNotifyOptions>;
    inject?: any[];
  }): DynamicModule {
    // Options are only known at runtime, so the gateway is always registered and
    // reads `socket.enable` / `socket.authorize` / `socket.tokenQueryParam` from
    // NOTIFY_OPTIONS. When disabled, connections are rejected (see gateway).
    const Gateway = createNotifyGateway({});
    const gateway: { providers: GatewayProvider[]; exports: (typeof NOTIFY_GATEWAY)[] } = {
      providers: [{ provide: NOTIFY_GATEWAY, useClass: Gateway }],
      exports: [NOTIFY_GATEWAY],
    };

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
        ...gateway.providers,
      ],
      exports: [
        FcmService,
        EmailService,
        NotifyService,
        NOTIFY_OPTIONS,
        ...gateway.exports,
      ],
      global: true,
    };
  }
}
