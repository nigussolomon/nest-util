import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsInt,
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
    description: 'Assigned role ids',
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  roleIds?: number[];
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

  @ApiProperty({
    type: [Object],
    example: [{ id: 1, name: 'viewer' }],
  })
  roles!: { id: number; name: string }[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
