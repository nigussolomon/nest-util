import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class RolePermissionsDto {
  @ApiProperty({
    example: ['users.create', 'users.update'],
    type: [String],
    description: 'Permission names to assign or remove',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions!: string[];
}
