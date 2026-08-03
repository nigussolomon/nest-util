import { Inject, Injectable } from '@nestjs/common';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type {
  Message,
  BatchResponse,
  Messaging,
} from 'firebase-admin/messaging';
import { NOTIFY_OPTIONS } from '../constants';
import type { NestNotifyOptions } from '../interfaces/nest-notify-options.interface';
import type {
  PushPayload,
  PushResult,
  SendPushResult,
} from '../interfaces/notify-payload.interface';

const BATCH_LIMIT = 500;
const NEST_NOTIFY_APP_NAME = 'nest-notify';

const DEAD_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
]);

@Injectable()
export class FcmService {
  private app: App | undefined;

  constructor(
    @Inject(NOTIFY_OPTIONS)
    private readonly options: NestNotifyOptions
  ) {
    const fcm = this.options.fcm;
    if (
      fcm?.enabled &&
      !fcm.app &&
      !(fcm.projectId && fcm.clientEmail && fcm.privateKey)
    ) {
      throw new Error(
        'FcmService: fcm.enabled requires either fcm.app or fcm.projectId + fcm.clientEmail + fcm.privateKey'
      );
    }
  }

  /**
   * Send a push notification to a single device token.
   */
  async sendToToken(token: string, payload: PushPayload): Promise<SendPushResult> {
    const result = await this.sendToTokens([token], payload);
    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      results: result.results,
    };
  }

  /**
   * Send a push notification to multiple device tokens.
   * Tokens are automatically batched (max 500 per FCM call).
   */
  async sendToTokens(
    tokens: string[],
    payload: PushPayload
  ): Promise<SendPushResult> {
    const messaging = this.getMessaging();
    const results: PushResult[] = [];
    let successCount = 0;

    for (let i = 0; i < tokens.length; i += BATCH_LIMIT) {
      const chunk = tokens.slice(i, i + BATCH_LIMIT);
      const messages = chunk.map((token) => this.buildMessage(token, payload));
      const batch: BatchResponse = await messaging.sendEach(messages);

      batch.responses.forEach((response, idx) => {
        const token = chunk[idx];
        if (response.success) {
          successCount += 1;
          results.push({ token, success: true });
        } else {
          const err = response.error as
            | { code?: string; message?: string }
            | undefined;
          results.push({
            token,
            success: false,
            code: err?.code,
            error: err?.message ?? 'Unknown FCM error',
          });
        }
      });
    }

    return {
      successCount,
      failureCount: results.length - successCount,
      results,
    };
  }

  /**
   * Extract tokens that FCM reports as permanently invalid, so the
   * caller can prune them from the device-token store.
   */
  getDeadTokens(result: SendPushResult): string[] {
    return result.results
      .filter(
        (r) => !r.success && r.code && DEAD_TOKEN_ERROR_CODES.has(r.code)
      )
      .map((r) => r.token);
  }

  private getMessaging(): Messaging {
    const fcm = this.options.fcm;
    if (!fcm?.enabled) {
      throw new Error('FcmService: fcm is not enabled');
    }
    if (fcm.app) {
      return getMessaging(fcm.app as App);
    }
    if (!this.app) {
      const existing = getApps().find(
        (a) => a.name === NEST_NOTIFY_APP_NAME
      );
      this.app =
        existing ??
        initializeApp(
          {
            projectId: fcm.projectId,
            credential: cert({
              projectId: fcm.projectId,
              clientEmail: fcm.clientEmail,
              privateKey: fcm.privateKey,
            }),
          },
          NEST_NOTIFY_APP_NAME
        );
    }
    return getMessaging(this.app);
  }

  private buildMessage(token: string, payload: PushPayload): Message {
    const message: Message = { token };

    if (payload.title || payload.body || payload.imageUrl) {
      message.notification = {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      };
    }
    if (payload.data) {
      message.data = payload.data;
    }
    if (payload.android) {
      message.android = payload.android as unknown as Message['android'];
    }
    if (payload.apns) {
      message.apns = payload.apns as unknown as Message['apns'];
    }
    if (payload.clickAction) {
      message.webpush = { fcmOptions: { link: payload.clickAction } };
      const android = message.android ?? {};
      android.notification = {
        clickAction: payload.clickAction,
      } as NonNullable<Message['android']>['notification'];
      message.android = android;
    }

    return message;
  }
}
