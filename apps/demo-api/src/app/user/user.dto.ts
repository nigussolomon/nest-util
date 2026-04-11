import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'alice@example.com',
    description: 'The email of the user',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Alice Johnson' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    default: ['viewer'],
    description: 'Assigned RBAC roles',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
