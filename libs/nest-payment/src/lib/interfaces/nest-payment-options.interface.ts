import { PaymentProvider } from './payment-provider.interface';
import { WebhookEvent } from './payment-webhook.interface';
import { PaymentEntity } from '../entities/payment.entity';

export interface NestPaymentOptions {
  /** Registered payment providers */
  providers: PaymentProvider[];

  /** Webhook endpoint configuration */
  webhook?: {
    /** Enable the webhook endpoint. Default: true */
    enable?: boolean;
    /** Webhook route path segment. Default: 'webhook' */
    path?: string;
    /** Use raw body for signature verification. Default: true */
    rawBody?: boolean;
    /** Enable in-memory event deduplication. Default: true */
    deduplicate?: boolean;
    /** Deduplication TTL in milliseconds. Default: 300000 (5 min) */
    deduplicationTtlMs?: number;
  };

  /** Reconciliation configuration */
  reconciliation?: {
    /** Enable reconciliation features. Default: true */
    enable?: boolean;
    /** Time after which a pending/processing payment is considered stale (ms). Default: 600000 (10 min) */
    staleAfterMs?: number;
  };

  /** Callback when a webhook event is processed */
  onWebhook?: (event: WebhookEvent, rawBody: Buffer) => Promise<void> | void;

  /** Callback when reconciliation finds a DB/provider mismatch */
  onReconciliationMismatch?: (
    payment: PaymentEntity,
    providerStatus: string
  ) => Promise<void> | void;

  /** Controller configuration */
  controller?: {
    /** Enable the auto-registered controller. Default: true */
    enable?: boolean;
    /** Controller route prefix. Default: 'payments' */
    path?: string;
    /** RBAC permission keys */
    permissions?: {
      checkout?: string;
      list?: string;
      refund?: string;
      subscriptions?: string;
      reconcile?: string;
    };
  };
}
