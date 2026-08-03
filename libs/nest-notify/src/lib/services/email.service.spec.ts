import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import { createTransport } from 'nodemailer';

describe('EmailService', () => {
  const sendMail = jest.fn();

  const baseOptions = {
    smtp: {
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      user: 'user',
      pass: 'pass',
      from: { name: 'App', address: 'no-reply@example.com' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ accepted: ['x@example.com'] });
    (createTransport as unknown as jest.Mock).mockReturnValue({ sendMail });
  });

  describe('constructor validation', () => {
    it('throws at construction when enabled without transport or host/port/from', () => {
      expect(
        () =>
          new EmailService({
            smtp: { enabled: true },
          } as never)
      ).toThrow(/smtp.enabled requires/);
    });

    it('accepts a pre-built transport', () => {
      expect(
        () =>
          new EmailService({
            smtp: { enabled: true, transport: { sendMail }, from: { address: 'a@b.c' } },
          } as never)
      ).not.toThrow();
    });

    it('does not throw when smtp is disabled', () => {
      expect(() => new EmailService({} as never)).not.toThrow();
    });
  });

  describe('send', () => {
    it('sends the payload with the configured sender', async () => {
      const service = new EmailService(baseOptions as never);
      await service.send({
        to: 'recipient@example.com',
        subject: 'Hello',
        html: '<b>Hi</b>',
      });

      expect(sendMail).toHaveBeenCalledWith({
        from: { name: 'App', address: 'no-reply@example.com' },
        to: 'recipient@example.com',
        subject: 'Hello',
        html: '<b>Hi</b>',
      });
    });

    it('uses an injected transport when provided', async () => {
      const service = new EmailService({
        smtp: { enabled: true, transport: { sendMail }, from: { address: 'a@b.c' } },
      } as never);

      await service.send({ to: 'x@example.com', subject: 'S', text: 'body' });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'x@example.com', subject: 'S', text: 'body' })
      );
    });

    it('throws when smtp is not enabled', async () => {
      const service = new EmailService({} as never);
      await expect(
        service.send({ to: 'x@example.com', subject: 'S' })
      ).rejects.toThrow(/smtp is not enabled/);
    });

    it('propagates transport errors', async () => {
      sendMail.mockRejectedValue(new Error('connection refused'));
      const service = new EmailService(baseOptions as never);

      await expect(
        service.send({ to: 'x@example.com', subject: 'S' })
      ).rejects.toThrow('connection refused');
    });
  });
});
