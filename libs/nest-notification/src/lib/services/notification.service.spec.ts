import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { MailService } from './mail.service';
import { WebhookService } from './webhook.service';
import { NotificationEntity } from '../entities/notification.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: jest.Mocked<Repository<NotificationEntity>>;
  let mailService: jest.Mocked<MailService>;
  let webhookService: jest.Mocked<WebhookService>;

  const mockNotification: NotificationEntity = {
    id: 'uuid-1',
    channel: 'mail',
    status: 'pending',
    recipientId: 'user-1',
    payload: undefined,
    errorMessage: undefined,
    metadata: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            send: jest.fn(),
            isConfigured: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repo = module.get(getRepositoryToken(NotificationEntity));
    mailService = module.get(MailService);
    webhookService = module.get(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send – mail channel', () => {
    it('should send a mail notification and mark as sent', async () => {
      repo.create.mockReturnValue({ ...mockNotification });
      repo.save.mockResolvedValue({ ...mockNotification, status: 'sent' });
      mailService.send.mockResolvedValue(undefined);

      const result = await service.send({
        channel: 'mail',
        recipientId: 'user-1',
        mail: {
          to: 'user@example.com',
          subject: 'Hello',
          text: 'World',
        },
      });

      expect(repo.create).toHaveBeenCalled();
      expect(mailService.send).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Hello',
        text: 'World',
      });
      expect(result.status).toBe('sent');
    });

    it('should mark notification as failed when mail send throws', async () => {
      const failedNotification = { ...mockNotification };
      repo.create.mockReturnValue(failedNotification);
      repo.save.mockResolvedValue({ ...failedNotification, status: 'failed' });
      mailService.send.mockRejectedValue(new Error('SMTP error'));

      const result = await service.send({
        channel: 'mail',
        mail: {
          to: 'user@example.com',
          subject: 'Hello',
        },
      });

      expect(result.status).toBe('failed');
      expect(failedNotification.errorMessage).toBe('SMTP error');
    });

    it('should fail when mail input is missing', async () => {
      const notification = { ...mockNotification };
      repo.create.mockReturnValue(notification);
      repo.save.mockResolvedValue({ ...notification, status: 'failed' });

      const result = await service.send({ channel: 'mail' });

      expect(result.status).toBe('failed');
      expect(notification.errorMessage).toContain('Mail input is required');
    });
  });

  describe('send – webhook channel', () => {
    it('should send a webhook notification and mark as sent', async () => {
      const webhookNotif = { ...mockNotification, channel: 'webhook' as const };
      repo.create.mockReturnValue(webhookNotif);
      repo.save.mockResolvedValue({ ...webhookNotif, status: 'sent' });
      webhookService.send.mockResolvedValue(undefined);

      const result = await service.send({
        channel: 'webhook',
        webhook: {
          url: 'https://example.com/hook',
          payload: { event: 'user.created' },
        },
      });

      expect(webhookService.send).toHaveBeenCalledWith({
        url: 'https://example.com/hook',
        payload: { event: 'user.created' },
      });
      expect(result.status).toBe('sent');
    });

    it('should mark notification as failed when webhook throws', async () => {
      const webhookNotif = { ...mockNotification, channel: 'webhook' as const };
      repo.create.mockReturnValue(webhookNotif);
      repo.save.mockResolvedValue({ ...webhookNotif, status: 'failed' });
      webhookService.send.mockRejectedValue(new Error('Connection refused'));

      const result = await service.send({
        channel: 'webhook',
        webhook: {
          url: 'https://example.com/hook',
          payload: {},
        },
      });

      expect(result.status).toBe('failed');
      expect(webhookNotif.errorMessage).toBe('Connection refused');
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const queryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[mockNotification], 1]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

      const result = await service.findAll({
        channel: 'mail',
        status: 'sent',
        recipientId: 'user-1',
        page: 1,
        limit: 5,
      });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('n');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('n.channel = :channel', {
        channel: 'mail',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('n.status = :status', {
        status: 'sent',
      });
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(result).toEqual({
        data: [mockNotification],
        meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
      });
    });
  });

  describe('findById', () => {
    it('should find a notification by id', async () => {
      repo.findOne.mockResolvedValue(mockNotification);

      const result = await service.findById('uuid-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
      expect(result).toEqual(mockNotification);
    });

    it('should return null when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findById('unknown');

      expect(result).toBeNull();
    });
  });
});
