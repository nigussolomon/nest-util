export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'canceled';

export interface CreateCheckoutParams {
  /** Amount in smallest currency unit (e.g. cents) */
  amount: number;
  /** ISO 4217 currency code (e.g. 'ETB', 'USD') */
  currency: string;
  /** Customer email */
  customerEmail: string;
  /** Customer name (optional, provider-dependent) */
  customerName?: string;
  /** Customer last name (optional, provider-dependent) */
  customerLastName?: string;
  /** Consumer's internal order/transaction ID */
  orderId?: string;
  /** Human-readable description */
  description?: string;
  /** Idempotency key to prevent duplicate charges */
  idempotencyKey?: string;
  /** Callback URL for provider to POST payment result */
  callbackUrl?: string;
  /** Return URL to redirect user after payment */
  returnUrl?: string;
  /** Arbitrary metadata passed through to the provider */
  metadata?: Record<string, unknown>;
}

export interface CheckoutSessionResult {
  /** Provider's transaction/session reference */
  providerReference: string;
  /** URL to redirect the customer to for payment */
  checkoutUrl: string;
  /** Provider's unique payment ID (if different from providerReference) */
  providerPaymentId?: string;
  /** Pass-through metadata from provider response */
  metadata?: Record<string, unknown>;
}

export interface CreateSubscriptionParams {
  /** Amount per billing period */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Customer email */
  customerEmail: string;
  /** Customer name */
  customerName?: string;
  /** Customer last name */
  customerLastName?: string;
  /** Billing interval */
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Number of intervals between billings (e.g. 1 = every month, 3 = every 3 months) */
  intervalCount?: number;
  /** Description */
  description?: string;
  /** Idempotency key */
  idempotencyKey?: string;
  /** Callback URL */
  callbackUrl?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface SubscriptionResult {
  providerReference: string;
  providerSubscriptionId: string;
  status: PaymentStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateRefundParams {
  /** The provider payment ID to refund */
  providerPaymentId: string;
  /** Refund amount (if partial). If omitted, full refund. */
  amount?: number;
  /** Reason for refund */
  reason?: string;
  /** Idempotency key */
  idempotencyKey?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  providerReference: string;
  providerRefundId: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  /** Unique provider identifier (e.g. 'stripe', 'chapa', 'paypal') */
  id: string;

  /** Create a checkout session / initialize a transaction */
  createCheckoutSession(
    params: CreateCheckoutParams
  ): Promise<CheckoutSessionResult>;

  /** Create a recurring subscription */
  createSubscription?(
    params: CreateSubscriptionParams
  ): Promise<SubscriptionResult>;

  /** Cancel an active subscription */
  cancelSubscription?(providerSubscriptionId: string): Promise<void>;

  /** Create a refund for a payment */
  createRefund?(params: CreateRefundParams): Promise<RefundResult>;

  /** Parse raw webhook/callback body into a normalized WebhookEvent */
  parseWebhookEvent(
    rawBody: Buffer,
    headers: Record<string, string>
  ): Promise<import('./payment-webhook.interface').WebhookEvent>;

  /** Verify webhook signature. Return true if valid. */
  verifyWebhookSignature?(
    rawBody: Buffer,
    headers: Record<string, string>
  ): boolean;

  /** Query provider for actual payment status (used by reconciliation) */
  getPaymentStatus?(providerPaymentId: string): Promise<PaymentStatus | null>;
}
