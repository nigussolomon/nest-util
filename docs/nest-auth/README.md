# nest-auth Setup Guide

This guide is based on the current implementation in `libs/nest-auth`.

## 1) Install

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-auth@^1.1.0 @nestjs/jwt @nestjs/passport typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger class-validator bcrypt
```

## 2) Prepare Requirements

1. Ensure TypeORM is configured.
2. Ensure your `User` entity includes fields for:
   - identifier (for example `email`)
   - password field (for example `password`)
   - refresh token hash field (default `refreshToken`)
   - access token hash field (default `accessToken`)
   - *(Optional, for OTP)* `otpCodeHash`, `otpCodeExpiresAt`, `otpRequestAttempts`, `otpLastSentAt`, `otpLockedUntil`
   - *(Optional, for Password Reset)* `passwordResetTokenHash`, `passwordResetTokenExpiresAt`
3. Add DTOs for login/register/refresh payloads.

## 3) Register `AuthModule`

In your root module:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto';
import { permissionRegistry } from './auth/permission-registry';

@Module({
  imports: [
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: process.env.JWT_SECRET ?? 'super-secret-key',
      refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      refreshTokenField: 'refreshToken',
      accessTokenField: 'accessToken',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      relations: ['userRoles', 'userRoles.role'],
      rbac: {
        userRolesRelation: 'userRoles',
        rolesKey: 'userRoles',
        nestedRoleKey: 'role',
      },
      permissionRegistry,
    }),
  ],
})
export class AppModule {}
```

## 4) Protect Endpoints

Use JWT and permission guards:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
  type AuthUser,
} from '@nest-util/nest-auth';

@Controller('profile')
export class ProfileController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.access')
  adminOnly() {
    return { ok: true };
  }
}
```

## 5) Built-in Auth Endpoints

`AuthModule` provides these endpoints under `/auth`:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/update-password`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/reset`
- `POST /auth/otp/request`
- `POST /auth/otp/login`
- `GET /auth/me/permissions`
- `POST /auth/logout`
- Admin-protected role/permission management endpoints under `/auth/roles`, `/auth/users/...`

## 6) Example DTOs

```ts
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
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

## 7) Update Password

Users can update their own password by providing their current password and a new password.

```ts
// POST /auth/update-password
// Requires: JwtAuthGuard
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

## 8) Password Reset (Token-based)

To enable password reset, configure the `passwordReset` option in `AuthModule.forRoot`. You must provide a `deliverToken` callback to send the reset link/token to the user.

```ts
AuthModule.forRoot({
  // ... other options
  passwordReset: {
    enabled: true,
    tokenLength: 64, // Length of the generated token
    tokenTtlSeconds: 3600, // Token validity in seconds (1 hour)
    tokenField: 'passwordResetTokenHash', // DB field to store hashed token
    expiresAtField: 'passwordResetTokenExpiresAt', // DB field to store expiration
    deliverToken: async ({ identifier, token, expiresAt }) => {
      // TODO: Send email/SMS with the reset token or link
      console.log(`Send reset token ${token} to ${identifier}`);
    },
  },
})
```

**Endpoints:**
- `POST /auth/password-reset/request`: Accepts `{ email: "user@example.com" }`. Returns success even if the user doesn't exist to prevent account enumeration.
- `POST /auth/password-reset/reset`: Accepts `{ token: "reset_token", newPassword: "new_password" }`. Invalidates all existing sessions upon success.

## 9) OTP Login

To enable One-Time Password (OTP) login, configure the `otp` option in `AuthModule.forRoot`. You must provide a `deliverCode` callback.

```ts
AuthModule.forRoot({
  // ... other options
  otp: {
    enabled: true,
    codeLength: 6,
    ttlSeconds: 300, // Code validity in seconds (5 minutes)
    cooldownSeconds: 60, // Minimum time between requests
    maxAttempts: 5, // Max failed attempts before lockout
    lockSeconds: 300, // Lockout duration in seconds
    channel: 'email',
    deliverCode: async ({ identifier, code, expiresAt }) => {
      // TODO: Send email/SMS with the OTP code
      console.log(`Send OTP code ${code} to ${identifier}`);
    },
  },
})
```

**Endpoints:**
- `POST /auth/otp/request`: Accepts `{ email: "user@example.com" }`. Triggers the `deliverCode` callback.
- `POST /auth/otp/login`: Accepts `{ email: "user@example.com", otpCode: "123456" }`. Validates the code and returns auth tokens.

## 10) Help Notes

- `refresh` currently expects `refreshToken` in request body.
- Access and refresh tokens are validated against hashed nonce values stored in DB, enabling single-session token rotation.
- If you enable RBAC, ensure `relations` include role relations needed during JWT validation.
- Use `disabledRoutes` to hard-disable selected auth endpoints (for example `['register', 'otp/request']`).
