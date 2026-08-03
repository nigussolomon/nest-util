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

### Super Admin Bypass

Configure a `superAdminPermission` in RBAC options. Any user with this permission bypasses all `@Permissions()` checks on every route, including custom evaluators.

```ts
AuthModule.forRoot({
  // ...
  rbac: {
    superAdminPermission: 'admin.access',
    // ...
  },
})
```

When `superAdminPermission` is set and the user's resolved permissions include it, `PermissionsGuard` returns `true` immediately — no `@Permissions()` requirement is checked.

### API Key Authentication

JwtAuthGuard automatically detects the `x-api-key` header. When present, it delegates validation to ApiKeyService instead of JWT. This means `@UseGuards(JwtAuthGuard, PermissionsGuard)` works for both JWT and API key requests without needing `ApiKeyGuard` explicitly.

```ts
@Controller('data')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('data.read')
export class DataController {
  // Works with both JWT Bearer token and X-API-Key header
}
```

## 5) Built-in Auth Endpoints

`AuthModule` provides these endpoints under `/auth`:

### Authentication
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/update-password`
- `POST /auth/logout`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/reset`
- `POST /auth/otp/request`
- `POST /auth/otp/login`

### Permissions
- `GET /auth/me/permissions` — current user's resolved permissions
- `GET /auth/permissions` — registered permission catalog (admin-protected)

### Roles (admin-protected)
- `POST /auth/roles`
- `GET /auth/roles`
- `POST /auth/roles/:roleId/permissions`
- `DELETE /auth/roles/:roleId/permissions`

### User Roles (admin-protected)
- `POST /auth/users/:userId/roles/:roleId`
- `DELETE /auth/users/:userId/roles/:roleId`
- `GET /auth/users/:userId/roles`

### API Keys (admin-protected)
- `POST /auth/api-keys`
- `GET /auth/api-keys`
- `DELETE /auth/api-keys/:id`
- `POST /auth/api-keys/:id/roles/:roleId`
- `DELETE /auth/api-keys/:id/roles/:roleId`

### Assisted Onboarding
- `POST /auth/onboarding/start` (agent, `onboarding.start`)
- `POST /auth/onboarding/complete` (agent, `onboarding.complete`)
- `POST /auth/onboarding/user` (OnboardingJwtGuard only)

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

## 10) Assisted Onboarding

To enable agent-assisted onboarding, configure the `onboarding` option in `AuthModule.forRoot`. An agent starts the flow on behalf of an invitee (OTP is sent to the invitee), then enters the invitee's OTP to complete it and receives a **single-purpose onboarding JWT** that only works on `POST /auth/onboarding/user` to create the user. No password is ever set; created users log in with OTP.

```ts
AuthModule.forRoot({
  // ... other options
  onboarding: {
    enabled: true,
    codeLength: 6,
    ttlSeconds: 300, // Code validity in seconds (5 minutes)
    cooldownSeconds: 60, // Minimum time between start requests
    maxAttempts: 5, // Max failed completes before lockout
    lockSeconds: 300, // Lockout duration in seconds
    channel: 'email',
    onboardingTokenSecret: process.env.ONBOARDING_TOKEN_SECRET, // default: jwtSecret
    onboardingTokenExpiresIn: '15m',
    deliverCode: async ({ identifier, code, expiresAt }) => {
      // TODO: Send email/SMS with the OTP code to the invitee
      console.log(`Send onboarding OTP ${code} to ${identifier}`);
    },
  },
})
```

**Endpoints:**
- `POST /auth/onboarding/start`: Agent-only (`onboarding.start`). Accepts `{ email: "invitee@example.com" }`. Triggers the `deliverCode` callback. Rate-limited like OTP login.
- `POST /auth/onboarding/complete`: Agent-only (`onboarding.complete`). Accepts `{ email: "invitee@example.com", code: "123456" }`. Validates the code and returns a single-use `onboarding_token`.
- `POST /auth/onboarding/user`: Guarded only by `OnboardingJwtGuard` (Bearer onboarding token). Accepts `{ email: "invitee@example.com" }`, creates the user with `registerHooks` and `verifiedAt` set, and consumes the attempt. Returns `ConflictException` if the user already exists.

Permissions `onboarding.start` and `onboarding.complete` are the fixed convention — register them in your permission registry.

## 11) Help Notes

- `refresh` currently expects `refreshToken` in request body.
- Access and refresh tokens are validated against hashed nonce values stored in DB, enabling single-session token rotation.
- If you enable RBAC, ensure `relations` include role relations needed during JWT validation.
- Use `disabledRoutes` to hard-disable selected auth endpoints (for example `['register', 'otp/request']`).
- `JwtAuthGuard` auto-detects `x-api-key` header — no need to add `ApiKeyGuard` separately.
- `superAdminPermission` in `rbac` config grants full access across all guarded routes.
