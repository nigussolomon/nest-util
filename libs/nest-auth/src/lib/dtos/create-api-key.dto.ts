import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'production-api',
    description: 'Human-readable name for the API key',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: [1, 2],
    type: [Number],
    description: 'Role IDs to assign to the key',
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  roleIds?: number[];

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00.000Z',
    description: 'Optional expiration date',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
