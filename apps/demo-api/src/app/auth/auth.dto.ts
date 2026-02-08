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
