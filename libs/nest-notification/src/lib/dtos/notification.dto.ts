import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SendMailDto {
  @ApiProperty({ example: 'user@example.com', description: 'Recipient email address or addresses' })
  @IsNotEmpty()
  to!: string | string[];

  @ApiProperty({ example: 'Welcome aboard!', description: 'Email subject' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({ example: '<h1>Hello</h1>', description: 'HTML body' })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ example: 'Hello', description: 'Plain text body' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'CC recipients' })
  @IsOptional()
  cc?: string | string[];

  @ApiPropertyOptional({ description: 'BCC recipients' })
  @IsOptional()
  bcc?: string | string[];
}

export class SendWebhookDto {
  @ApiProperty({ example: 'https://example.com/hook', description: 'Webhook target URL' })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ example: { event: 'user.created', userId: '123' }, description: 'Payload to POST' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Extra HTTP headers to include' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class SendNotificationDto {
  @ApiProperty({ example: 'mail', enum: ['mail', 'webhook'], description: 'Notification channel' })
  @IsIn(['mail', 'webhook'])
  @IsNotEmpty()
  channel!: 'mail' | 'webhook';

  @ApiPropertyOptional({ example: 'user-uuid', description: 'Recipient identifier' })
  @IsString()
  @IsOptional()
  recipientId?: string;

  @ApiPropertyOptional({ type: SendMailDto })
  @IsOptional()
  @Type(() => SendMailDto)
  mail?: SendMailDto;

  @ApiPropertyOptional({ type: SendWebhookDto })
  @IsOptional()
  @Type(() => SendWebhookDto)
  webhook?: SendWebhookDto;

  @ApiPropertyOptional({ description: 'Arbitrary metadata stored with the notification' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListNotificationsDto {
  @ApiPropertyOptional({ enum: ['mail', 'webhook'] })
  @IsIn(['mail', 'webhook'])
  @IsOptional()
  channel?: string;

  @ApiPropertyOptional({ enum: ['pending', 'sent', 'failed'] })
  @IsIn(['pending', 'sent', 'failed'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recipientId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
