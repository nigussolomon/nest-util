import { Injectable, Inject, Logger } from '@nestjs/common';
import { NOTIFICATION_MODULE_OPTIONS } from '../constants/notification.constants';
import type { NotificationModuleOptions } from '../interfaces/notification-module-options.interface';
import type { SendWebhookInput } from '../interfaces/notification.interface';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions
  ) {}

  async send(input: SendWebhookInput): Promise<void> {
    const { url, payload, headers = {} } = input;
    const timeoutMs = this.options.webhook?.timeoutMs ?? 5000;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.options.webhook?.secret) {
      requestHeaders['X-Webhook-Secret'] = this.options.webhook.secret;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed with status ${response.status}`);
      }

      this.logger.log(`Webhook delivered to ${url}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
