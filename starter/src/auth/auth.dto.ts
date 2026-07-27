import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'password123' })
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'password123' })
  password!: string;

  @ApiProperty({ example: 'John Doe', required: false })
  name?: string;
}

export class RefreshDto {
  @ApiProperty()
  refreshToken!: string;
}

export class OtpRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;
}

export class OtpLoginDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: '123456' })
  otpCode!: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;
}

export class PasswordResetDto {
  @ApiProperty({ example: 'reset-token-here' })
  token!: string;

  @ApiProperty({ example: 'new-password123' })
  newPassword!: string;
}
