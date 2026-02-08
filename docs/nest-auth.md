# @nest-util/nest-auth

`@nest-util/nest-auth` is a dynamic NestJS authentication library designed to be flexible, plug-and-play, and easy to override. It uses the Provider Pattern to allow developers to configure user entities, field names, and security settings while providing custom DTOs for validation and documentation.

## Installation

```bash
npm install @nest-util/nest-auth @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

## Quick Start

### 1. Define Authentication DTOs

In your API project, define the DTOs you want to use for authentication. This gives you full control over validation and Swagger documentation.

```typescript
// auth.dto.ts
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
}

export class RefreshDto {
  @ApiProperty()
  refreshToken!: string;
}
```

### 2. Register AuthModule

In your `AppModule`, register the `AuthModule` using the `forRoot` method and provide your DTO types.

```typescript
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto';

@Module({
  imports: [
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email', // Default: 'email'
      passkeyField: 'password', // Default: 'password'
      jwtSecret: 'your-secret-key',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      accessTokenField: 'accessToken', // Field to store hashed AT nonce
      refreshTokenField: 'refreshToken', // Field to store hashed RT nonce
    }),
  ],
})
export class AppModule {}
```

### 3. Protect Your Routes

Use the `JwtAuthGuard` and `@CurrentUser()` decorator.

```typescript
import { JwtAuthGuard, CurrentUser, AuthUser } from '@nest-util/nest-auth';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  @Get('me')
  getProfile(@CurrentUser() user: AuthUser) {
    return user;
  }
}
```

## Features

### DTO Factory Pattern
The library uses a factory pattern for its `AuthController`. When you provide `loginDto`, `registerDto`, or `refreshDto` in `forRoot`, the library dynamically generates a controller that uses these classes for request validation and Swagger documentation.

### Type Safety
The library exports `AuthUser` (class) and `AuthTokens` (interface) to ensure type safety across your application.

### Secure Validation
- **Single-Use Tokens**: Every access and refresh token contains a unique nonce.
- **Explicit Hashing**: Tokens are hashed and stored in the database.
- **Automatic Selection**: The library explicitly selects hidden fields (like `accessToken` or `password`) only when needed for validation, ensuring no sensitive data leaks into `AuthUser`.

## Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and get tokens |
| POST | `/auth/refresh` | Get new tokens using refresh token |
| GET  | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | Logout user |

## Advanced Usage

### Overriding AuthService
You can extend the base `AuthService` to add custom logic.

```typescript
@Injectable()
export class CustomAuthService extends AuthService {
  async register(data: any): Promise<AuthUser> {
    // Custom logic before registration
    const user = await super.register(data);
    // Custom logic after registration
    return user;
  }
}
```

Then register it in your module:

```typescript
@Module({
  providers: [
    {
      provide: AuthService,
      useClass: CustomAuthService,
    },
  ],
})
export class UserOverrideModule {}
```
