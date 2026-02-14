import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ownerType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ownerId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
