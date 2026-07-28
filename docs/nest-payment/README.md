# nest-payment

Provider-agnostic payment library for NestJS. Handles checkout sessions, subscriptions, refunds, webhook/callback handling, reconciliation, and idempotency.

## Installation

```bash
pnpm add @nest-util/nest-payment
```

Peer dependencies:

```bash
pnpm add @nestjs/common @nestjs/swagger @nestjs/typeorm class-validator class-transformer typeorm
# Optional — for @CurrentUser() integration
pnpm add @nest-util/nest-auth
```

## Quick Start

### Step 1: Implement a Payment Provider

No SDK is bundled. You implement `PaymentProvider` and register it via DI.

```typescript
import { PaymentProvider, PaymentCheckoutResult, PaymentStatusResult } from '@nest-util/nest-payment';

export class ChapaProvider implements PaymentProvider {
  readonly name = 'chapa';
  readonly supportsSubscriptions = false;
  readonly supportsRefunds = false;

  async createCheckout(input): Promise<PaymentCheckoutResult> {
    const response = await chapa.initialize({
      amount: input.amount,
      currency: input.currency,
      callback_url: input.callbackUrl,
      tx_ref: input.idempotencyKey,
    });
    return {
      providerPaymentId: response.tx_ref,
      checkoutUrl: response.checkout_url,
      status: 'pending',
    };
  }

  async getPaymentStatus(providerPaymentId): Promise<PaymentStatusResult> {
    const result = await chapa.verify(providerPaymentId);
    return { status: result.status === 'success' ? 'succeeded' : 'pending' };
  }

  async refund(providerPaymentId, amount) {
    throw new Error('Chapa does not support refunds');
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
      provider: new ChapaProvider(),
      entities: [Payment, Subscription, Refund],
      webhookSecret: process.env.WEBHOOK_SECRET,
      webhookTtlMs: 300_000, // 5 min dedup window
      controller: {
        path: 'payments',
        permissions: {
          checkout: 'payments.create',
          refund: 'payments.refund',
          subscription: 'payments.subscribe',
        },
      },
    }),
  ],
})
export class AppModule {}
```

### Step 3: Async Configuration

```typescript
NestPaymentModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    provider: new ChapaProvider(),
    entities: [Payment, Subscription, Refund],
    webhookSecret: config.getOrThrow('WEBHOOK_SECRET'),
  }),
  inject: [ConfigService],
})
```

## Configuration Options

| Option | Type | Description |
|---|---|---|
| `provider` | `PaymentProvider` | Your payment gateway implementation |
| `entities` | `Entity[]` | TypeORM entities for Payment, Subscription, Refund |
| `webhookSecret` | `string` | Secret for verifying webhook signatures |
| `webhookTtlMs` | `number` | In-memory dedup window (default: `300_000` = 5 min) |
| `enableReconciliation` | `boolean` | Enable stale payment reconciliation (default: `true`) |
| `reconciliationIntervalMs` | `number` | How often to check stale payments (default: `600_000`) |
| `controller.path` | `string` | Controller route path (default: `'payments'`) |
| `controller.permissions` | `object` | RBAC permissions for checkout, refund, subscription |
| `controller.enable` | `boolean` | Auto-register controller (default: `true`) |

## Architecture

### Webhook-First Design

The webhook/callback is the source of truth for payment status — **not** the API response. Providers like Chapa use `callback_url` (redirect-based), while others like Stripe use signature-verified webhooks.

```typescript
// Callback endpoint (Chapa-style redirect)
app.use('/payments/callback', async (req, res) => {
  await paymentService.handleCallback({ providerPaymentId: req.query.tx_ref });
  res.redirect('/success');
});

// Webhook endpoint (Stripe-style)
app.use('/payments/webhook', async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, sig, secret);
  await paymentService.handleWebhook({ providerPaymentId: event.data.object.id });
  res.sendStatus(200);
});
```

### Status Transitions

Status transitions are validated in the service layer. Backward transitions are ignored (idempotent).

- `pending` → `processing` → `succeeded` | `failed`
- `succeeded` → `refunded` (when refund is issued)
- `active` → `canceled` | `past_due` | `trialing` (subscriptions)

### Reconciliation

Stale payments in `pending` or `processing` status are checked against the provider via `getPaymentStatus()`. Configurable interval and TTL.

### Idempotency

- DB unique constraints on `(provider, providerPaymentId)`
- `idempotencyKey` field prevents duplicate charges
- Forward-only status transitions prevent race conditions

## Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/payments/checkout` | Create a checkout session | Required |
| `POST` | `/payments/callback` | Handle provider callback/redirect | Public |
| `POST` | `/payments/webhook` | Handle provider webhook | Public (verified) |
| `GET` | `/payments/:id` | Get payment status | Required |
| `POST` | `/payments/:id/refund` | Issue a refund | Required |
| `POST` | `/payments/subscriptions` | Create a subscription | Required |
| `PATCH` | `/payments/subscriptions/:id` | Cancel a subscription | Required |

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

- Uses `callback_url` (user redirect) instead of webhooks
- Status check via `chapa.verify(tx_ref)` — polled by reconciliation
- No native subscription or refund support — set `supportsSubscriptions: false`, `supportsRefunds: false`
- Currency: `ETB` (Ethiopian Birr) or `USD`
