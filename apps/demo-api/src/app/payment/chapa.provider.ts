import { Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreateCheckoutParams,
  CheckoutSessionResult,
  WebhookEvent,
  PaymentStatus,
} from '@nest-util/nest-payment';

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

export class ChapaProvider implements PaymentProvider {
  readonly id = 'chapa';
  private readonly logger = new Logger(ChapaProvider.name);

  constructor(private readonly secretKey: string) {}

  async createCheckoutSession(
    params: CreateCheckoutParams
  ): Promise<CheckoutSessionResult> {
    const txRef = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const body: Record<string, unknown> = {
      amount: String(params.amount),
      currency: params.currency,
      email: params.customerEmail,
      first_name: params.customerName,
      last_name: params.customerLastName,
      tx_ref: txRef,
      callback_url: params.callbackUrl,
      return_url: params.returnUrl,
    };

    if (params.description) {
      body['customization[title]'] = params.description;
      body['customization[description]'] = params.description;
    }

    this.logger.log(`Initializing Chapa checkout: tx_ref=${txRef}`);

    const response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      status: string;
      message?: string;
      data?: { checkout_url?: string };
    };

    if (data.status !== 'success' || !data.data?.checkout_url) {
      this.logger.error(`Chapa response: ${JSON.stringify(data)}`);
      throw new Error(
        `Chapa initialization failed: ${JSON.stringify(data.message) ?? response.statusText}`
      );
    }

    this.logger.log(`Chapa checkout URL generated: ${txRef}`);

    return {
      providerReference: txRef,
      checkoutUrl: data.data.checkout_url,
      metadata: { txRef },
    };
  }

  async getPaymentStatus(
    providerPaymentId: string
  ): Promise<PaymentStatus | null> {
    try {
      const response = await fetch(
        `${CHAPA_BASE_URL}/transaction/verify/${providerPaymentId}`,
        {
          headers: { Authorization: `Bearer ${this.secretKey}` },
        }
      );

      const data = (await response.json()) as {
        status: string;
        data?: { status?: string };
      };

      if (data.status !== 'success' || !data.data?.status) {
        return null;
      }

      return this.mapChapaStatus(data.data.status);
    } catch (error) {
      this.logger.error(
        `Chapa verify failed for ${providerPaymentId}: ${error instanceof Error ? error.message : 'unknown'}`
      );
      return null;
    }
  }

  async parseWebhookEvent(
    rawBody: Buffer,
    _headers: Record<string, string>
  ): Promise<WebhookEvent> {
    const body = JSON.parse(rawBody.toString()) as Record<string, unknown>;

    // Chapa callback sends: { trx_ref, ref_id, status }
    const txRef = (body.trx_ref ?? body.tx_ref) as string | undefined;
    const refId = (body.ref_id ?? body.reference) as string | undefined;
    const status = (body.status ?? '') as string;

    return {
      provider: this.id,
      type: `payment.${status}`,
      providerPaymentId: txRef ?? refId ?? 'unknown',
      status: this.mapChapaStatus(status),
      metadata: {
        trx_ref: txRef,
        ref_id: refId,
        rawStatus: status,
        ...body,
      },
      timestamp: new Date(),
    };
  }

  verifyWebhookSignature(_rawBody: Buffer, _headers: Record<string, string>): boolean {
    // Chapa does not provide webhook signature verification.
    // In production, use callback verification via the verify endpoint instead.
    return true;
  }

  private mapChapaStatus(status: string): PaymentStatus {
    switch (status.toLowerCase()) {
      case 'success':
        return 'succeeded';
      case 'failed':
        return 'failed';
      case 'pending':
        return 'pending';
      default:
        return 'pending';
    }
  }
}
