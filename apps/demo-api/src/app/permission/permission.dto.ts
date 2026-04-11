import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'posts' })
  @IsString()
  @IsNotEmpty()
  resource!: string;

  @ApiProperty({ example: 'read' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiPropertyOptional({ example: 'posts:read' })
  @IsString()
  @IsOptional()
  key?: string;

  @ApiPropertyOptional({ example: 'Read all posts' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}

export class PermissionResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  resource!: string;

  @ApiProperty()
  action!: string;

  @ApiPropertyOptional()
  description?: string;
}
