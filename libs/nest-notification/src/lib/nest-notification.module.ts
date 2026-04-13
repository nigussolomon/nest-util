import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NOTIFICATION_MODULE_OPTIONS } from './constants/notification.constants';
import { NotificationEntity } from './entities/notification.entity';
import {
  NotificationModuleAsyncOptions,
  NotificationModuleOptions,
  NotificationModuleOptionsFactory,
} from './interfaces/notification-module-options.interface';
import { MailService } from './services/mail.service';
import { WebhookService } from './services/webhook.service';
import { NotificationService } from './services/notification.service';

@Module({})
export class NestNotificationModule {
  static forRoot(options: NotificationModuleOptions): DynamicModule {
    return {
      module: NestNotificationModule,
      imports: [TypeOrmModule.forFeature([NotificationEntity])],
      providers: [
        { provide: NOTIFICATION_MODULE_OPTIONS, useValue: options },
        MailService,
        WebhookService,
        NotificationService,
      ],
      exports: [NotificationService, TypeOrmModule],
    };
  }

  static forRootAsync(options: NotificationModuleAsyncOptions): DynamicModule {
    return {
      module: NestNotificationModule,
      imports: [...(options.imports ?? []), TypeOrmModule.forFeature([NotificationEntity])],
      providers: [
        ...this.createAsyncProviders(options),
        MailService,
        WebhookService,
        NotificationService,
      ],
      exports: [NotificationService, TypeOrmModule],
    };
  }

  private static createAsyncProviders(
    options: NotificationModuleAsyncOptions
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    const useClass = options.useClass ?? options.useExisting;

    if (!useClass) {
      throw new Error('forRootAsync requires useFactory, useClass, or useExisting');
    }

    return [
      {
        provide: NOTIFICATION_MODULE_OPTIONS,
        useFactory: async (factory: NotificationModuleOptionsFactory) =>
          factory.createNotificationModuleOptions(),
        inject: [useClass],
      },
      ...(options.useClass
        ? [{ provide: useClass, useClass: options.useClass }]
        : []),
    ];
  }
}
