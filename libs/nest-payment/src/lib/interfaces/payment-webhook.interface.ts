import { PaymentStatus } from './payment-provider.interface';

export interface WebhookEvent {
  /** Provider identifier (e.g. 'stripe', 'chapa') */
  provider: string;
  /** Event type (e.g. 'checkout.session.completed', 'payment_intent.succeeded') */
  type: string;
  /** Provider's payment/transaction reference */
  providerPaymentId?: string;
  /** Provider's subscription reference (for subscription events) */
  providerSubscriptionId?: string;
  /** Provider's refund reference (for refund events) */
  providerRefundId?: string;
  /** Payment status mapped to our status enum */
  status?: PaymentStatus;
  /** Amount in smallest currency unit */
  amount?: number;
  /** ISO 4217 currency code */
  currency?: string;
  /** Whether this is a subscription-related event */
  isSubscriptionEvent?: boolean;
  /** Whether this is a refund-related event */
  isRefundEvent?: boolean;
  /** Arbitrary metadata from the provider */
  metadata?: Record<string, unknown>;
  /** Timestamp of the event from the provider */
  timestamp?: Date;
}
