import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ description: 'File ID from the upload request' })
  @IsNotEmpty()
  @IsUUID()
  fileId!: string;

  @ApiProperty({ description: 'S3 object key' })
  @IsNotEmpty()
  @IsString()
  key!: string;
}
