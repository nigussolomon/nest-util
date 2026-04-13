import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { NOTIFICATION_MODULE_OPTIONS } from '../constants/notification.constants';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;

  const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
  const mockTransporter = { sendMail: mockSendMail };

  beforeEach(async () => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: {
            mail: {
              host: 'smtp.example.com',
              port: 587,
              secure: false,
              auth: { user: 'user@example.com', pass: 'secret' },
              from: '"App" <no-reply@example.com>',
            },
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be configured when mail options are present', () => {
    expect(service.isConfigured()).toBe(true);
  });

  it('should send a mail', async () => {
    await service.send({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"App" <no-reply@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      })
    );
  });

  it('should join multiple recipients', async () => {
    await service.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@example.com, b@example.com' })
    );
  });

  it('should throw when mail is not configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: {},
        },
      ],
    }).compile();

    const unconfigured = module.get<MailService>(MailService);

    await expect(
      unconfigured.send({ to: 'x@example.com', subject: 'Test' })
    ).rejects.toThrow('Mail transport is not configured');
  });
});
