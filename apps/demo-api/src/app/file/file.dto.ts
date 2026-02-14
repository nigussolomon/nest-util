import { UploadFileDto } from '@nest-util/nest-file';
import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty, IsString } from 'class-validator';

export class DemoUploadFileDto extends UploadFileDto {
  @ApiProperty({
    description: 'Base64 encoded file contents',
    example: 'SGVsbG8gZnJvbSBuZXN0LXV0aWwh',
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  contentBase64!: string;
}
