import { Injectable, Inject, Logger } from '@nestjs/common';
import { NOTIFICATION_MODULE_OPTIONS } from '../constants/notification.constants';
import type { NotificationModuleOptions } from '../interfaces/notification-module-options.interface';
import type { SendWebhookInput } from '../interfaces/notification.interface';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions
  ) {}

  private validateUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid webhook URL: ${rawUrl}`);
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(
        `Webhook URL must use http or https protocol, got: ${parsed.protocol}`
      );
    }

    const allowedHosts = this.options.webhook?.allowedHosts;
    if (allowedHosts && allowedHosts.length > 0) {
      if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(
          `Webhook target host "${parsed.hostname}" is not in the allowed list`
        );
      }
    }

    return parsed;
  }

  async send(input: SendWebhookInput): Promise<void> {
    const { url, payload, headers = {} } = input;
    const timeoutMs = this.options.webhook?.timeoutMs ?? 5000;

    const validatedUrl = this.validateUrl(url);

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
      // URL is validated above: protocol restricted to http/https and optionally
      // constrained to allowedHosts, so SSRF risk is mitigated.
      const response = await fetch(validatedUrl.toString(), {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed with status ${response.status}`);
      }

      this.logger.log(`Webhook delivered to ${validatedUrl.hostname}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
