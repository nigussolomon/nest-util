import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UnregisterDeviceDto {
  @ApiProperty({
    description: 'FCM registration token to remove',
  })
  @IsString()
  @MinLength(1)
  token!: string;
}
