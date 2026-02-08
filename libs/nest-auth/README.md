# @nest-util/nest-auth

A dynamic NestJS authentication library designed to be flexible, plug-and-play, and easy to override. It uses the Provider Pattern to allow developers to configure user entities, field names, and security settings while providing custom DTOs for validation and documentation.

## Features

- **Flexible DTOs**: Provide your own `LoginDto`, `RegisterDto`, and `RefreshDto` to control validation and Swagger documentation.
- **Dynamic Field Mapping**: Map your User entity's fields (e.g., `email`, `password`, `refreshToken`) easily.
- **Type Safety**: Built-in `AuthUser` and `AuthTokens` types.
- **Single-Use Refresh Tokens**: Robust refresh token rotation logic to prevent replay attacks.
- **Profile Endpoint**: Built-in `/auth/me` to retrieve the current user profile.

## Quick Start

### 1. Register AuthModule

In your `AppModule`, register the `AuthModule` and provide your DTO types:

```typescript
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto';

@Module({
  imports: [
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'your-secret-key',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
    }),
  ],
})
export class AppModule {}
```

### 2. Protect Routes

Use `JwtAuthGuard` and `@CurrentUser()` decorator:

```typescript
import { JwtAuthGuard, CurrentUser, AuthUser } from '@nest-util/nest-auth';

@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: AuthUser) {
  return user; // Returns user without sensitive fields
}
```

## Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and get tokens | No |
| POST | `/auth/refresh` | Get new access token | No (Refresh Token in Body) |
| GET  | `/auth/me` | Get current user profile | Yes (JWT) |
| POST | `/auth/logout` | Logout user | Yes (JWT) |

## Development

- **Building**: `nx build nest-auth`
- **Testing**: `nx test nest-auth`
