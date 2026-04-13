export type NotificationChannel = 'mail' | 'webhook';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendWebhookInput {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface SendNotificationInput {
  channel: NotificationChannel;
  recipientId?: string;
  mail?: SendMailInput;
  webhook?: SendWebhookInput;
  metadata?: Record<string, unknown>;
}
