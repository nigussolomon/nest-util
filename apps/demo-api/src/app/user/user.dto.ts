import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserResponseDto {
  id!: number;

  email!: string;

  name!: string;

  isActive!: boolean;

  createdAt!: Date;

  updatedAt!: Date;
}
