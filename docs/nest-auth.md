# @nest-util/nest-auth

`@nest-util/nest-auth` is a dynamic NestJS authentication library designed to be flexible, plug-and-play, and easy to override. It uses the Provider Pattern to allow developers to configure user entities, field names, and security settings seamlessly.

## Installation

```bash
pnpm add @nest-util/nest-auth @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

## Quick Start

### 1. Register AuthModule

In your `AppModule`, register the `AuthModule` using the `forRoot` method. 

```typescript
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';

@Module({
  imports: [
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email', // The unique field for login (default: 'email')
      passkeyField: 'password', // The password field name (default: 'password')
      jwtSecret: 'your-secret-key',
      expiresIn: '1h', // Access token expiration (default: '1h')
      refreshTokenSecret: 'your-refresh-secret', // Optional
      refreshTokenExpiresIn: '7d', // Refresh token expiration (default: '7d')
      refreshTokenField: 'refreshToken', // Field in user entity (default: 'refreshToken')
      disabledRoutes: ['register'], // Optional: Disable specific routes
    }),
  ],
})
export class AppModule {}
```

### 2. Protect Your Routes

By default, we recommend using the `JwtAuthGuard` globally or per-controller.

```typescript
import { JwtAuthGuard } from '@nest-util/nest-auth';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  // ...
}
```

### Global Authentication

To protect all routes by default and use `@Public()` to exclude specific ones, register `JwtAuthGuard` as a global provider:

```typescript
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@nest-util/nest-auth';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

## Features

### Dynamic Field Mapping
The library doesn't hardcode field names. If your user entity uses `username` instead of `email`, or `pwd` instead of `password`, simply configure them in `forRoot`.

### Custom Decorators

#### `@CurrentUser()`
Extract the authenticated user object directly from the request.

```typescript
@Get('me')
getProfile(@CurrentUser() user: any) {
  return user;
}
```

#### `@Public()`
Bypass the global `JwtAuthGuard` for specific routes (like login or register).

```typescript
@Public()
@Post('login')
login(@Body() dto: LoginDto) {
  // ...
}
```

### Base Controller & Service
The library provides `AuthService` and `AuthController` out of the box with logic for:
- **Registration**: Handles user creation and password hashing using bcrypt via `POST /auth/register`.
- **Login**: Validates credentials and generates JWT access and **refresh tokens** via `POST /auth/login`.
- **Refresh**: Handles **single-use refresh token rotation** via `POST /auth/refresh`. 
  - Token can be passed in the `x-refresh-token` header (recommended) or in the request body as `refreshToken`.
  - To ensure uniqueness and prevent replay attacks, each refresh token includes a unique nonce and is hashed before being stored in the database.
- **Sensitive Data**: All responses automatically exclude the password hash and the refresh token field.

### Swagger Documentation
Endpoints are automatically documented if you use `@nestjs/swagger`. Standard DTOs like `LoginDto`, `RegisterDto`, and `RefreshDto` are exported for your convenience.

## Advanced Usage

### Overriding Base Logic
Since the library uses the Provider Pattern, you can extend the base classes to add custom logic.

```typescript
@Injectable()
export class CustomAuthService extends AuthService {
  async register(data: any) {
    // Custom logic before/after registration
    return super.register(data);
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
