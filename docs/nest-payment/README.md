# nest-payment

Provider-agnostic payment library for NestJS. Handles checkout sessions, subscriptions, refunds, webhook/callback handling, reconciliation, and idempotency.

## Installation

```bash
pnpm add @nest-util/nest-payment @nest-util/nest-error
```

Peer dependencies:

```bash
pnpm add @nestjs/common @nestjs/swagger @nestjs/typeorm class-validator class-transformer typeorm
# Optional — for @CurrentUser() integration
pnpm add @nest-util/nest-auth
```

`@nest-util/nest-error` is required. Register `LocalizationModule.forRoot(...)`
once for consistent error responses (see
[libs/nest-error/README.md](./../../libs/nest-error/README.md)).

## Quick Start

### Step 1: Implement a Payment Provider

No SDK is bundled. You implement `PaymentProvider` and register it via DI.

```typescript
import { PaymentProvider, CheckoutSessionResult, PaymentStatus } from '@nest-util/nest-payment';

export class ChapaProvider implements PaymentProvider {
  readonly id = 'chapa';

  async createCheckoutSession(input): Promise<CheckoutSessionResult> {
    const tx_ref = `tx_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const response = await chapa.initialize({
      amount: input.amount,
      currency: input.currency,
      callback_url: input.callbackUrl,
      tx_ref,
    });
    return {
      providerReference: response.tx_ref,
      checkoutUrl: response.checkout_url,
      metadata: { tx_ref },
    };
  }

  async parseWebhookEvent(rawBody, headers): Promise<WebhookEvent> {
    // Parse the raw body into a normalized WebhookEvent
    const payload = JSON.parse(rawBody.toString());
    return { provider: this.id, type: 'chapa.checkout.completed', providerPaymentId: payload.tx_ref, status: 'succeeded' };
  }

  async getPaymentStatus(providerPaymentId): Promise<PaymentStatus | null> {
    const result = await chapa.verify(providerPaymentId);
    return result.status === 'success' ? 'succeeded' : 'pending';
  }
}
```

### Step 2: Register NestPaymentModule

```typescript
import { NestPaymentModule } from '@nest-util/nest-payment';
import { ChapaProvider } from './chapa.provider';

@Module({
  imports: [
    NestPaymentModule.forRoot({
      providers: [new ChapaProvider()],   // array of providers
      entities: [Payment, Subscription, Refund],
      webhook: {
        enable: true,
        path: 'webhook',        // default
        rawBody: true,          // default — raw body for signature checks
        deduplicate: true,      // default — in-memory dedup
        deduplicationTtlMs: 300_000, // 5 min window
      },
      onWebhook: async (event, rawBody) => {
        // Optional hook fired after each processed webhook event
      },
      onReconciliationMismatch: async (payment, providerStatus) => {
        // Optional hook when reconciliation finds a mismatch
      },
      controller: {
        path: 'payments',
        permissions: {
          checkout: 'payments.create',
          list: 'payments.read',
          refund: 'payments.refund',
          subscriptions: 'payments.subscriptions',
          reconcile: 'payments.reconcile',
        },
      },
    }),
  ],
})
export class AppModule {}
```

The module is registered with `global: true`, so `PaymentService`, `SubscriptionService`, `RefundService`, and the `PAYMENT_OPTIONS` token are available app-wide without re-importing.

### Step 3: Async Configuration

```typescript
NestPaymentModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    providers: [new ChapaProvider()],
    entities: [Payment, Subscription, Refund],
    webhook: { enable: true, path: 'webhook' },
  }),
  inject: [ConfigService],
})
```

## Configuration Options

| Option | Type | Description |
|---|---|---|
| `providers` | `PaymentProvider[]` | Your payment gateway implementations (array) |
| `entities` | `Entity[]` | TypeORM entities for Payment, Subscription, Refund |
| `webhook.enable` | `boolean` | Enable webhook endpoint (default: `true`) |
| `webhook.path` | `string` | Webhook route segment (default: `'webhook'`) |
| `webhook.rawBody` | `boolean` | Use raw body for signature verification (default: `true`) |
| `webhook.deduplicate` | `boolean` | In-memory event dedup (default: `true`) |
| `webhook.deduplicationTtlMs` | `number` | Dedup window (default: `300_000` = 5 min) |
| `reconciliation.enable` | `boolean` | Enable stale payment reconciliation (default: `true`) |
| `reconciliation.staleAfterMs` | `number` | Stale threshold in ms (default: `600_000` = 10 min) |
| `onWebhook` | `(event, rawBody) => void` | Called after each processed webhook event |
| `onReconciliationMismatch` | `(payment, providerStatus) => void` | Called when reconciliation finds a mismatch |
| `controller.path` | `string` | Controller route path (default: `'payments'`) |
| `controller.permissions` | `object` | RBAC permissions for checkout, refund, subscription |
| `controller.enable` | `boolean` | Auto-register controller (default: `true`) |

## Interfaces

### PaymentStatus

```ts
type PaymentStatus =
  | 'pending' | 'processing' | 'succeeded'
  | 'failed' | 'refunded' | 'canceled';
```

### PaymentProvider

Required: `id: string`, `createCheckoutSession(params): Promise<CheckoutSessionResult>`, `parseWebhookEvent(rawBody, headers): Promise<WebhookEvent>`.

Optional (feature detection): `createSubscription?`, `cancelSubscription?`, `createRefund?`, `verifyWebhookSignature?`, `getPaymentStatus?`. Set `supportsSubscriptions` / `supportsRefunds` is **not** part of the interface — implement the optional method to enable the feature.

### Params & Result Types

```ts
interface CreateCheckoutParams {
  amount: number;               // smallest currency unit (e.g. cents)
  currency: string;             // ISO 4217, e.g. 'ETB', 'USD'
  customerEmail: string;
  customerName?: string;
  customerLastName?: string;
  orderId?: string;
  description?: string;
  idempotencyKey?: string;      // prevents duplicate charges
  callbackUrl?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}
interface CheckoutSessionResult {
  providerReference: string;
  checkoutUrl: string;
  providerPaymentId?: string;
  metadata?: Record<string, unknown>;
}
interface CreateSubscriptionParams {
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerLastName?: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  intervalCount?: number;
  description?: string;
  idempotencyKey?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}
interface SubscriptionResult {
  providerReference: string;
  providerSubscriptionId: string;
  status: PaymentStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  metadata?: Record<string, unknown>;
}
interface CreateRefundParams {
  providerPaymentId: string;
  amount?: number;              // partial refund if provided
  reason?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}
interface RefundResult {
  providerReference: string;
  providerRefundId: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
}
interface WebhookEvent {
  provider: string;
  type: string;
  providerPaymentId?: string;
  providerSubscriptionId?: string;
  providerRefundId?: string;
  status?: PaymentStatus;
  amount?: number;
  currency?: string;
  isSubscriptionEvent?: boolean;
  isRefundEvent?: boolean;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}
```

`PAYMENT_OPTIONS` is the injection token for the resolved `NestPaymentOptions`.

## Architecture

### Webhook-First Design

The webhook/callback is the source of truth for payment status — **not** the API response. The single endpoint `POST /payments/webhook/:provider` handles both provider webhooks and Chapa-style `callback_url` redirects. It verifies the signature (if the provider implements `verifyWebhookSignature`), parses the body via `parseWebhookEvent`, deduplicates, and dispatches to `paymentService.handleWebhook(event)` / `subscriptionService.handleWebhook(event)` / `refundService.handleWebhook(event)`, then fires the `onWebhook` callback.

```typescript
// Chapa-style: point callback_url at the endpoint, which responds 200 and
// your provider redirects the user to returnUrl
POST /payments/webhook/chapa

// Stripe-style: signature-verified webhook, same endpoint
POST /payments/webhook/stripe
```

### Status Transitions

Status transitions are validated in the service layer. Backward transitions are ignored (idempotent).

- `pending` → `processing` → `succeeded` | `failed`
- `succeeded` → `refunded` (when refund is issued)
- `active` → `canceled` | `past_due` | `trialing` (subscriptions)

### Reconciliation

Stale payments in `pending`, `processing`, or `succeeded` status are checked against the provider via `getPaymentStatus()`. A per-ID endpoint is also available for targeted reconciliation. Payments in `failed`, `refunded`, or `canceled` are skipped.

### Idempotency

- DB unique constraints on `(provider, providerPaymentId)` and `(provider, providerSubscriptionId)`
- `idempotencyKey` field prevents duplicate charges
- Forward-only status transitions prevent race conditions

## Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|---|
| `POST` | `/payments/checkout` | Create a checkout session | Required |
| `POST` | `/payments/webhook/:provider` | Handle provider webhook/callback | Public |
| `GET` | `/payments` | List all payments | Required |
| `GET` | `/payments/mine` | Get current user's payments | Required |
| `GET` | `/payments/:id` | Get payment by ID | Required |
| `POST` | `/payments/:id/refund` | Issue a refund | Required |
| `GET` | `/payments/subscriptions` | List all subscriptions | Required |
| `POST` | `/payments/subscriptions` | Create a subscription | Required |
| `DELETE` | `/payments/subscriptions/:id` | Cancel a subscription | Required |
| `POST` | `/payments/reconcile` | Bulk reconcile stale payments | Required |
| `POST` | `/payments/reconcile/:id` | Reconcile a single payment | Required |

## Services

### PaymentService

- `createCheckout(userId, dto: CreateCheckoutDto)` → `{ payment, checkoutUrl?, error? }` — creates a `pending` record first, then calls the provider; on provider failure the payment stays `pending` with an `error` (never marked failed). Idempotent when `idempotencyKey` is supplied.
- `handleWebhook(event: WebhookEvent)` → `PaymentEntity` — applies forward-only status transitions, or creates a record for unknown payments.
- `findOne(id)` / `findByProviderPaymentId(provider, providerPaymentId)`
- `findAll({ page?, limit?, orderBy?, orderDirection?, provider?, status? })` → `{ data, meta }`
- `findMine(userId, query?)` → `{ data, meta }` (user-scoped)
- `reconcilePayment(id)` → `PaymentEntity` — reconciles a single reconcilable payment; orphaned payments (no `providerPaymentId`) are marked `failed`.
- `reconcileStalePayments({ staleAfterMs? })` → `{ checked, updated, failed }` — bulk reconciliation of `pending`/`processing`/`succeeded` payments older than the threshold.
- `getProvider(providerId)` → `PaymentProvider` — resolves a provider by `id`.

### SubscriptionService

- `create(userId, dto: CreateSubscriptionDto)` → `{ subscription, error? }`
- `cancel(subscriptionId)` → `SubscriptionEntity` — cancels an active subscription (requires provider `cancelSubscription`)
- `handleWebhook(event)` → `SubscriptionEntity | null`
- `findOne(id)` / `findAll(query?)` / `findMine(userId, query?)`

### RefundService

- `create(userId, dto: CreateRefundDto)` → `{ refund, error? }` (requires provider `createRefund`)
- `handleWebhook(event)` → `RefundEntity | null`
- `findOne(id)` / `findByPaymentId(paymentId)` / `findAll(query?)`

## Testing

Use the testing entry point for mock factories and reusable test suites.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { paymentServiceTests } from '@nest-util/nest-payment/testing';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  paymentServiceTests({
    serviceClass: PaymentService,
    entity: Payment,
    provider: mockProvider,
    test: {
      createPayload: { amount: 100, currency: 'ETB' },
    },
  });
});
```

### Mock Utilities

| Utility | Description |
|---|---|
| `createMockPaymentProvider()` | Mock provider with all methods stubbed |
| `createMockPaymentEntity()` | Default mock payment entity |
| `createMockSubscriptionEntity()` | Default mock subscription entity |
| `createMockRefundEntity()` | Default mock refund entity |
| `createMockRepository()` | Mock TypeORM repository |

## Chapa Integration Notes

Chapa is the first reference implementation. Key differences from other providers:

- Uses `callback_url` (user redirect) instead of webhooks — point it at `POST /payments/webhook/chapa`
- Status check via `chapa.verify(tx_ref)` — polled by reconciliation via `getPaymentStatus`
- No native subscription or refund support — simply omit `createSubscription` / `cancelSubscription` / `createRefund`; the checkout/refund endpoints then return a "feature not supported" error
- Currency: `ETB` (Ethiopian Birr) or `USD`
