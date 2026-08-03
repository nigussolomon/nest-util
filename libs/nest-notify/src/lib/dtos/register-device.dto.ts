import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'FCM registration token',
    example: 'fJ9x...device-token...',
  })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiPropertyOptional({
    enum: ['android', 'ios', 'web'],
    default: 'web',
  })
  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: 'android' | 'ios' | 'web';

  @ApiPropertyOptional({ description: 'Optional client-generated device identifier' })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
