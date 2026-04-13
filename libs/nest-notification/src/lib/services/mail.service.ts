import { Injectable, Inject, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { NOTIFICATION_MODULE_OPTIONS } from '../constants/notification.constants';
import type { NotificationModuleOptions } from '../interfaces/notification-module-options.interface';
import type { SendMailInput } from '../interfaces/notification.interface';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions
  ) {
    if (options.mail) {
      this.transporter = nodemailer.createTransport({
        host: options.mail.host,
        port: options.mail.port ?? 587,
        secure: options.mail.secure ?? false,
        auth: {
          user: options.mail.auth.user,
          pass: options.mail.auth.pass,
        },
      });
    }
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.transporter || !this.options.mail) {
      throw new Error('Mail transport is not configured');
    }

    const { to, subject, html, text, cc, bcc } = input;

    await this.transporter.sendMail({
      from: this.options.mail.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text,
      cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
    });

    this.logger.log(`Mail sent to ${Array.isArray(to) ? to.join(', ') : to}`);
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }
}
