import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { NOTIFY_OPTIONS } from '../constants';
import type { NestNotifyOptions } from '../interfaces/nest-notify-options.interface';
import type { EmailPayload } from '../interfaces/notify-payload.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport: Transporter | undefined;

  constructor(
    @Inject(NOTIFY_OPTIONS)
    private readonly options: NestNotifyOptions
  ) {
    const smtp = this.options.smtp;
    if (
      smtp?.enabled &&
      !smtp.transport &&
      !(smtp.host && smtp.port && smtp.from?.address)
    ) {
      throw new Error(
        'EmailService: smtp.enabled requires either smtp.transport or smtp.host + smtp.port + smtp.from.address'
      );
    }
  }

  /**
   * Send an email through the configured SMTP transport.
   */
  async send(payload: EmailPayload): Promise<void> {
    const transport = this.getTransport();
    const smtp = this.options.smtp!;
    await transport.sendMail({
      from: smtp.from,
      ...payload,
    });
    const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    this.logger.log(`Email sent to ${to}: ${payload.subject}`);
  }

  private getTransport(): Transporter {
    const smtp = this.options.smtp;
    if (!smtp?.enabled) {
      throw new Error('EmailService: smtp is not enabled');
    }
    if (!this.transport) {
      this.transport =
        (smtp.transport as Transporter | undefined) ??
        createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure ?? false,
          ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
        });
    }
    return this.transport;
  }
}
