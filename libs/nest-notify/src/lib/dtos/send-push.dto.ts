import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class SendPushDto {
  @ApiPropertyOptional({
    description:
      'Recipient user ID. Defaults to the authenticated user when omitted.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Notification title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Notification body' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Image URL to display' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Deep link / click action' })
  @IsOptional()
  @IsString()
  clickAction?: string;

  @ApiPropertyOptional({
    description: 'Free-form data payload (string values)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
