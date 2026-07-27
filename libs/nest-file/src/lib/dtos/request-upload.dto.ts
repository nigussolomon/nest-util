import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestUploadDto {
  @ApiProperty({ description: 'Original file name' })
  @IsNotEmpty()
  @IsString()
  fileName!: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsNotEmpty()
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'Optional folder path prefix', required: false })
  @IsOptional()
  @IsString()
  folder?: string;
}
