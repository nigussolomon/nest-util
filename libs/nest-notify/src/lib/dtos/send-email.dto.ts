import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendEmailDto {
  @ApiPropertyOptional({
    description:
      'Recipient user ID (for history association). Defaults to the authenticated user when omitted.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Recipient email address(es)' })
  @IsEmail({}, { each: true })
  to!: string | string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject!: string;

  @ApiPropertyOptional({ description: 'Plain-text body' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'HTML body' })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({ description: 'CC recipient(s)' })
  @IsOptional()
  @IsEmail({}, { each: true })
  cc?: string | string[];

  @ApiPropertyOptional({ description: 'BCC recipient(s)' })
  @IsOptional()
  @IsEmail({}, { each: true })
  bcc?: string | string[];

  @ApiPropertyOptional({ description: 'Reply-To address' })
  @IsOptional()
  @IsString()
  replyTo?: string;
}
