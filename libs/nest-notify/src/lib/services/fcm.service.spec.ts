import { FcmService } from './fcm.service';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  cert: jest.fn((o: unknown) => ({ __credential: o })),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(),
}));

import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

describe('FcmService', () => {
  const sendEach = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getMessaging as unknown as jest.Mock).mockReturnValue({ sendEach });
    (getApps as unknown as jest.Mock).mockReturnValue([]);
  });

  const baseOptions = {
    fcm: {
      enabled: true,
      projectId: 'test-project',
      clientEmail: 'a@b.com',
      privateKey: '---KEY---',
    },
  };

  describe('constructor validation', () => {
    it('throws at construction when enabled without app or service-account', () => {
      expect(
        () => new FcmService({ fcm: { enabled: true } } as never)
      ).toThrow(/fcm.enabled requires/);
    });

    it('accepts an injected app instance', () => {
      const app = { name: 'default', options: {} };
      expect(
        () => new FcmService({ fcm: { enabled: true, app } } as never)
      ).not.toThrow();
    });

    it('does not throw when fcm is disabled', () => {
      expect(() => new FcmService({} as never)).not.toThrow();
    });
  });

  describe('sendToTokens', () => {
    it('builds FCM messages and aggregates results', async () => {
      sendEach.mockResolvedValue({
        successCount: 2,
        failureCount: 1,
        responses: [
          { success: true, messageId: 'm1' },
          { success: true, messageId: 'm2' },
          {
            success: false,
            error: { code: 'messaging/unknown-error', message: 'boom' },
          },
        ],
      });

      const service = new FcmService(baseOptions as never);
      const result = await service.sendToTokens(
        ['token-a', 'token-b', 'token-c'],
        { title: 'Hi', body: 'There', data: { deep: 'link' } }
      );

      expect(result).toEqual({
        successCount: 2,
        failureCount: 1,
        results: [
          { token: 'token-a', success: true },
          { token: 'token-b', success: true },
          {
            token: 'token-c',
            success: false,
            code: 'messaging/unknown-error',
            error: 'boom',
          },
        ],
      });

      expect(sendEach).toHaveBeenCalledTimes(1);
      const messages = sendEach.mock.calls[0][0];
      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        token: 'token-a',
        notification: { title: 'Hi', body: 'There' },
        data: { deep: 'link' },
      });
    });

    it('initializes firebase lazily with the service account', async () => {
      sendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const service = new FcmService(baseOptions as never);
      await service.sendToToken('token-a', { title: 'x' });

      expect(initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          credential: expect.anything(),
        }),
        'nest-notify'
      );
      expect(getMessaging).toHaveBeenCalled();
    });

    it('uses the injected app without initializing a new one', async () => {
      const app = { name: 'default', options: {} };
      sendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const service = new FcmService({
        fcm: { enabled: true, app },
      } as never);
      await service.sendToToken('token-a', { title: 'x' });

      expect(initializeApp).not.toHaveBeenCalled();
      expect(getMessaging).toHaveBeenCalledWith(app);
    });

    it('chunks tokens into batches of 500', async () => {
      sendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const tokens = Array.from({ length: 1001 }, (_, i) => `token-${i}`);
      const service = new FcmService(baseOptions as never);
      await service.sendToTokens(tokens, { title: 'x' });

      expect(sendEach).toHaveBeenCalledTimes(3);
      const firstBatch = sendEach.mock.calls[0][0];
      const lastBatch = sendEach.mock.calls[2][0];
      expect(firstBatch).toHaveLength(500);
      expect(lastBatch).toHaveLength(1);
    });

    it('includes clickAction / android / apns in the message', async () => {
      sendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const service = new FcmService(baseOptions as never);
      await service.sendToToken('token-a', {
        title: 'Hi',
        clickAction: 'https://example.com',
        apns: { payload: { aps: { alert: 'Hi' } } },
      });

      const message = sendEach.mock.calls[0][0][0];
      expect(message.webpush).toEqual({
        fcmOptions: { link: 'https://example.com' },
      });
      expect(message.android.notification.clickAction).toBe(
        'https://example.com'
      );
      expect(message.apns).toEqual({ payload: { aps: { alert: 'Hi' } } });
    });

    it('throws when fcm is not enabled', async () => {
      const service = new FcmService({} as never);
      await expect(service.sendToToken('t', { title: 'x' })).rejects.toThrow(
        /fcm is not enabled/
      );
    });
  });

  describe('getDeadTokens', () => {
    it('returns only permanently-invalid tokens', () => {
      const service = new FcmService(baseOptions as never);
      const result = {
        successCount: 1,
        failureCount: 2,
        results: [
          { token: 'good', success: true },
          {
            token: 'dead',
            success: false,
            code: 'messaging/registration-token-not-registered',
          },
          { token: 'temp', success: false, code: 'messaging/unknown-error' },
        ],
      };

      expect(service.getDeadTokens(result)).toEqual(['dead']);
    });
  });
});
