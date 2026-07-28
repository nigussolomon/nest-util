import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'Payment amount in smallest currency unit',
    example: 200,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'ETB',
  })
  @IsNotEmpty()
  @IsString()
  currency!: string;

  @ApiProperty({
    description: 'Customer email',
    example: 'john@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  customerEmail!: string;

  @ApiPropertyOptional({ description: 'Customer first name' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  customerLastName?: string;

  @ApiPropertyOptional({ description: 'Consumer internal order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Payment provider ID (e.g. stripe, chapa)',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate charges',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Callback URL for provider' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Return URL after payment' })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
