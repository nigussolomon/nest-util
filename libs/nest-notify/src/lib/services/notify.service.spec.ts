import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { DeviceTokenEntity } from '../entities/device-token.entity';
import { NotificationEntity } from '../entities/notification.entity';
import { NotifyService } from './notify.service';
import { FcmService } from './fcm.service';
import { EmailService } from './email.service';

describe('NotifyService', () => {
  let service: NotifyService;

  let deviceRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    delete: jest.Mock;
  };
  let notificationRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
  };
  let fcmService: {
    sendToToken: jest.Mock;
    sendToTokens: jest.Mock;
    getDeadTokens: jest.Mock;
  };
  let emailService: { send: jest.Mock };

  beforeEach(async () => {
    deviceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((e) => e),
      save: jest.fn((e) => Promise.resolve(e)),
      remove: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    };
    notificationRepo = {
      create: jest.fn((e) => e),
      save: jest.fn((e) => Promise.resolve({ id: 'n1', ...e })),
      findAndCount: jest.fn(),
    };
    fcmService = {
      sendToToken: jest.fn(),
      sendToTokens: jest.fn(),
      getDeadTokens: jest.fn(() => []),
    };
    emailService = { send: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        NotifyService,
        { provide: FcmService, useValue: fcmService },
        { provide: EmailService, useValue: emailService },
        {
          provide: getRepositoryToken(DeviceTokenEntity),
          useValue: deviceRepo,
        },
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: notificationRepo,
        },
      ],
    }).compile();

    service = module.get<NotifyService>(NotifyService);
  });

  // ─── Device tokens ────────────────────────────────────────

  describe('registerDeviceToken', () => {
    it('creates a new device token when none exists', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      const result = await service.registerDeviceToken(
        'user-1',
        'token-abc',
        'android',
        'device-42'
      );

      expect(deviceRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        token: 'token-abc',
        platform: 'android',
        deviceId: 'device-42',
      });
      expect(deviceRepo.save).toHaveBeenCalled();
      expect(result).toEqual({
        userId: 'user-1',
        token: 'token-abc',
        platform: 'android',
        deviceId: 'device-42',
      });
    });

    it('reassigns and updates an existing token', async () => {
      deviceRepo.findOne.mockResolvedValue({
        id: 'dt1',
        userId: 'old-user',
        token: 'token-abc',
        platform: 'web',
      });

      const result = await service.registerDeviceToken('user-2', 'token-abc', 'ios');

      expect(deviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'dt1', userId: 'user-2', platform: 'ios' })
      );
      expect(result.userId).toBe('user-2');
    });
  });

  describe('unregisterDeviceToken', () => {
    it('removes the token owned by the user', async () => {
      deviceRepo.findOne.mockResolvedValue({ id: 'dt1', userId: 'user-1', token: 't' });

      const result = await service.unregisterDeviceToken('user-1', 't');

      expect(result).toBe(true);
      expect(deviceRepo.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'dt1' })
      );
    });

    it('returns false when the token does not exist', async () => {
      deviceRepo.findOne.mockResolvedValue(null);
      expect(await service.unregisterDeviceToken('user-1', 't')).toBe(false);
    });

    it('throws when the token belongs to another user', async () => {
      deviceRepo.findOne.mockResolvedValue({ id: 'dt1', userId: 'other', token: 't' });
      await expect(service.unregisterDeviceToken('user-1', 't')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('listDeviceTokens', () => {
    it('queries tokens for the user', async () => {
      deviceRepo.find.mockResolvedValue([{ id: 'dt1', userId: 'user-1', token: 't' }]);
      const result = await service.listDeviceTokens('user-1');
      expect(deviceRepo.find).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(result).toHaveLength(1);
    });
  });

  // ─── Push ─────────────────────────────────────────────────

  describe('push', () => {
    it('returns empty result without sending when the user has no tokens', async () => {
      deviceRepo.find.mockResolvedValue([]);

      const result = await service.push('user-1', { title: 'Hi' });

      expect(fcmService.sendToTokens).not.toHaveBeenCalled();
      expect(result).toEqual({ successCount: 0, failureCount: 0, results: [] });
    });

    it('sends to all device tokens, records history, and prunes dead tokens', async () => {
      deviceRepo.find.mockResolvedValue([
        { id: 'dt1', userId: 'user-1', token: 't1' },
        { id: 'dt2', userId: 'user-1', token: 't2' },
      ]);
      fcmService.sendToTokens.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        results: [
          { token: 't1', success: true },
          { token: 't2', success: false, code: 'messaging/registration-token-not-registered' },
        ],
      });
      fcmService.getDeadTokens.mockReturnValue(['t2']);

      const result = await service.push('user-1', {
        title: 'Hi',
        body: 'There',
        data: { k: 'v' },
      });

      expect(fcmService.sendToTokens).toHaveBeenCalledWith(
        ['t1', 't2'],
        { title: 'Hi', body: 'There', data: { k: 'v' } }
      );
      expect(deviceRepo.delete).toHaveBeenCalledWith({ token: In(['t2']) });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          channel: 'push',
          provider: 'fcm',
          title: 'Hi',
          body: 'There',
          metadata: { k: 'v' },
          status: 'failed',
        })
      );
      expect(result.failureCount).toBe(1);
    });
  });

  describe('pushToToken', () => {
    it('sends to the token and records history with the token as recipient', async () => {
      fcmService.sendToToken.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        results: [{ token: 't1', success: true }],
      });

      await service.pushToToken('t1', { title: 'Hi' });

      expect(fcmService.sendToToken).toHaveBeenCalledWith('t1', { title: 'Hi' });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'push',
          provider: 'fcm',
          to: 't1',
          status: 'sent',
        })
      );
    });
  });

  // ─── Email ────────────────────────────────────────────────

  describe('email', () => {
    it('sends and records a sent notification', async () => {
      emailService.send.mockResolvedValue(undefined);

      const result = await service.email(
        { to: 'a@example.com', subject: 'S', html: '<p>Hi</p>' },
        'user-1'
      );

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'a@example.com',
        subject: 'S',
        html: '<p>Hi</p>',
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          channel: 'email',
          provider: 'smtp',
          subject: 'S',
          to: 'a@example.com',
          status: 'sent',
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('records a failed notification and rethrows on error', async () => {
      emailService.send.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.email({ to: 'a@example.com', subject: 'S' })
      ).rejects.toThrow('smtp down');

      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'email',
          status: 'failed',
          error: 'smtp down',
        })
      );
    });
  });

  // ─── History ──────────────────────────────────────────────

  describe('getNotifications', () => {
    it('paginates notifications for the user', async () => {
      notificationRepo.findAndCount.mockResolvedValue([[{ id: 'n1' }], 21]);

      const result = await service.getNotifications({
        userId: 'user-1',
        channel: 'push',
        page: 2,
        limit: 10,
      });

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'push' },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('omits empty filters', async () => {
      notificationRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getNotifications({});

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });
});
