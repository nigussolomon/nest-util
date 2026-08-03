/** Payload shape for a push notification. */
export interface PushPayload {
  /** Notification title (Android) / alert title (iOS) */
  title?: string;
  /** Notification body */
  body?: string;
  /** Optional URL of an image to display */
  imageUrl?: string;
  /** Deep link / action on click */
  clickAction?: string;
  /** Free-form data payload delivered to the app */
  data?: Record<string, string>;
  /** Android-specific options */
  android?: Record<string, unknown>;
  /** Apple-specific options */
  apns?: Record<string, unknown>;
}

/** Payload shape for an email. */
export interface EmailPayload {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  cid?: string;
}

/** A single push delivery outcome. */
export interface PushResult {
  token: string;
  success: boolean;
  /** Error message when `success` is false */
  error?: string;
  /** Firebase error code when `success` is false */
  code?: string;
}

/** Result of a push operation. */
export interface SendPushResult {
  successCount: number;
  failureCount: number;
  results: PushResult[];
}
