import { InjectionToken, ModuleMetadata } from '@nestjs/common';

export interface MailOptions {
  host: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface WebhookOptions {
  /** Default secret token added as X-Webhook-Secret header when provided */
  secret?: string;
  /** Timeout in milliseconds for webhook HTTP calls (default: 5000) */
  timeoutMs?: number;
  /**
   * Optional allowlist of hostnames permitted as webhook targets.
   * When set, any URL whose hostname is not in this list will be rejected.
   * Example: ['hooks.example.com', 'api.myapp.io']
   */
  allowedHosts?: string[];
}

export interface NotificationModuleOptions {
  mail?: MailOptions;
  webhook?: WebhookOptions;
}

export interface NotificationModuleOptionsFactory {
  createNotificationModuleOptions():
    | Promise<NotificationModuleOptions>
    | NotificationModuleOptions;
}

export interface NotificationModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: new (
    ...args: unknown[]
  ) => NotificationModuleOptionsFactory;
  useClass?: new (
    ...args: unknown[]
  ) => NotificationModuleOptionsFactory;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<NotificationModuleOptions> | NotificationModuleOptions;
  inject?: InjectionToken[];
}
