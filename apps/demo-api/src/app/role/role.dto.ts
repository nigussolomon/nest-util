import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'editor' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Can manage posts and comments' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Assigned permission ids',
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  permissionIds?: number[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class RoleResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({
    type: [Object],
    example: [{ id: 1, key: 'posts:read', resource: 'posts', action: 'read' }],
  })
  permissions!: {
    id: number;
    key: string;
    resource: string;
    action: string;
  }[];
}
