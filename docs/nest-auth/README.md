# nest-auth Setup Guide

This guide is based on the current implementation in `libs/nest-auth`.

## 1) Install

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-auth@^1.4.0 @nestjs/jwt @nestjs/passport typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger class-validator bcrypt
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
   - *(Optional, for Account Verification)* `isVerified`, `verifiedAt`, `verificationCodeHash`, `verificationCodeExpiresAt`, `verificationAttempts`, `verificationLastSentAt`, `verificationLockedUntil` (all configurable)
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

### User Management (admin-protected, when `userManagement` is configured)
- `GET /auth/users?page=1&limit=20&q=...&active=true` — paginated user list
- `GET /auth/users/:id` — fetch one user
- `POST /auth/users` — create a user (password hashed with bcrypt)
- `PATCH /auth/users/:id` — update allowed fields
- `POST /auth/users/:id/activate` — set the active field to `true`
- `POST /auth/users/:id/deactivate` — set the active field to `false`
- `DELETE /auth/users/:id` — delete a user
- `PATCH /auth/me` — self-service profile update (guarded by `profilePermission`, see below)

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

### Account Verification
- `POST /auth/verify` — verify account with the emailed code
- `POST /auth/verify/resend` — resend the verification code

## 6) User Management

Enable admin user management by adding a `userManagement` block to `AuthModule.forRoot`. Because the user entity is consumer-provided, the library cannot know its columns ahead of time, so the fields you may set on create/update are controlled by whitelists.

```ts
AuthModule.forRoot({
  // ...
  userManagement: {
    enabled: true,                       // default true when the block is present
    permission: 'admin.access',          // guards every route (default)
    activeField: 'isActive',             // active/inactive column (default)
    listFields: ['email', 'name'],       // columns returned in list/get responses (optional)
    createFields: ['name'],              // keys allowed in POST /auth/users (optional)
    updateFields: ['name', 'email'],     // keys allowed in PATCH /auth/users/:id (optional)
    profilePermission: 'profile.edit',   // guards PATCH /auth/me (default)
    profileFields: ['name'],             // keys a user may edit on PATCH /auth/me (optional)
    relations: ['userRoles'],            // eager-loaded relations (default: AuthModule relations)
    allowPassword: true,                 // accept a password on create, hashed with bcrypt (default)
    maxLimit: 100,                       // max page size (default)
  },
})
```

Notes:
- The routes are `GET/POST /auth/users`, `GET/PATCH/DELETE /auth/users/:id`, and `POST /auth/users/:id/activate|deactivate`, all guarded by `JwtAuthGuard` + `PermissionsGuard` with `permission` (`admin.access` by default).
- New users default to `activeField = true`.
- Without `createFields`/`updateFields`, any key except sensitive fields (password, refresh/access tokens, OTP/verification/password-reset columns) is accepted; with a whitelist, unknown keys are rejected with `400`.
- Passwords are never returned by list/get responses and cannot be updated via `PATCH` (admin password reset is intentionally out of scope).
- Identifier fields (e.g. `email`) are always accepted on create/update and checked for uniqueness on create.

### Self-service profile editing (`PATCH /auth/me`)

A user can edit their own profile with `PATCH /auth/me`. The target user is taken from the JWT (`@CurrentUser()`), never from the request body, so a user structurally cannot edit anyone else's profile. The route is guarded by `JwtAuthGuard` + `PermissionsGuard` with `profilePermission` (`'profile.edit'` by default) — assign this permission to a role so users can use it.

- Allowed keys come from `profileFields`, falling back to `updateFields`, then to any non-sensitive key.
- Password, the active flag, and all sensitive columns (tokens, OTP/verification/password-reset) are always rejected.
- When `profileFields` is set, identifiers are only editable if explicitly listed.

Example role assignment via the demo RBAC endpoints:

```http
POST /auth/roles        {"name": "User", "permissions": ["profile.edit"]}
POST /auth/users/1/roles/1
```

## 7) Example DTOs

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

## 8) Update Password

Users can update their own password by providing their current password and a new password.

```ts
// POST /auth/update-password
// Requires: JwtAuthGuard
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

## 9) Password Reset (Token-based)

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
    requestDto: PasswordResetRequestDto,
    resetDto: PasswordResetDto,
    buildResetContext: ({ identifier, user }) => ({ appName: 'MyApp' }),
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

## 10) OTP Login

To enable One-Time Password (OTP) login, configure the `otp` option in `AuthModule.forRoot`. You must provide a `deliverCode` callback.

```ts
AuthModule.forRoot({
  // ... other options
  otp: {
    enabled: true,
    codeLength: 6, // Code length (4-10)
    ttlSeconds: 300, // Code validity in seconds (5 minutes)
    cooldownSeconds: 60, // Minimum time between requests
    maxAttempts: 5, // Max failed attempts before lockout
    lockSeconds: 300, // Lockout duration in seconds
    channel: 'email',
    // Configurable DB field names (defaults shown):
    codeField: 'otpCodeHash',
    expiresAtField: 'otpCodeExpiresAt',
    attemptsField: 'otpRequestAttempts',
    lastSentAtField: 'otpLastSentAt',
    lockUntilField: 'otpLockedUntil',
    inputCodeField: 'otpCode', // request body field for the code
    // Optional DTOs / context:
    requestDto: OtpRequestDto,
    loginDto: OtpLoginDto,
    metadata: { purpose: 'login' },
    buildDeliveryContext: ({ identifier, user }) => ({ appName: 'MyApp' }),
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

## 11) Assisted Onboarding

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
    startDto: OnboardingStartDto,
    completeDto: OnboardingCompleteDto,
    createUserDto: OnboardingCreateUserDto,
    metadata: { source: 'sales' },
    buildDeliveryContext: ({ identifier }) => ({ inviter: 'support' }),
    deliverCode: async ({ identifier, code, expiresAt }) => {
      // TODO: Send email/SMS with the OTP code to the invitee
      console.log(`Send onboarding OTP ${code} to ${identifier}`);
    },
  },
})
```

**Endpoints:**
- `POST /auth/onboarding/start`: Agent-only (`onboarding.start`). Accepts `{ email: "invitee@example.com" }`. Triggers the `deliverCode` callback. Rate-limited like OTP login. Returns `ConflictException` if a user with that identifier already exists.
- `POST /auth/onboarding/complete`: Agent-only (`onboarding.complete`). Accepts `{ email: "invitee@example.com", code: "123456" }`. Validates the code and returns a single-use `onboarding_token`.
- `POST /auth/onboarding/user`: Guarded only by `OnboardingJwtGuard` (Bearer onboarding token). Accepts `{ email: "invitee@example.com" }`, creates the user with `registerHooks` and `verifiedAt` set, and consumes the attempt.

Permissions `onboarding.start` and `onboarding.complete` are the fixed convention — register them in your permission registry.

## 12) Account Verification

To require email/phone verification after registration, configure the `verification` option. A code is delivered to the new user (defaults to the first identifier field in the registration payload); they must verify before the account is considered active. Optionally combine with `loginDto`/OTP to reject logins from unverified accounts.

```ts
AuthModule.forRoot({
  // ... other options
  verification: {
    enabled: true,
    codeLength: 6,
    ttlSeconds: 600, // Code validity in seconds (10 minutes)
    cooldownSeconds: 60, // Minimum time between resends
    maxAttempts: 5, // Max failed verifications before lockout
    lockSeconds: 600, // Lockout duration in seconds
    channel: 'email',
    // Configurable DB field names (defaults shown):
    verifiedField: 'isVerified',
    verifiedAtField: 'verifiedAt',
    codeHashField: 'verificationCodeHash',
    expiresAtField: 'verificationCodeExpiresAt',
    attemptsField: 'verificationAttempts',
    lastSentAtField: 'verificationLastSentAt',
    lockUntilField: 'verificationLockedUntil',
    inputCodeField: 'code', // request body field for the code
    requestDto: VerificationRequestDto,
    verifyDto: VerificationVerifyDto,
    identifierField: 'email', // which identifier to deliver the code to
    deliverCode: async ({ identifier, code, expiresAt }) => {
      // TODO: Send email/SMS with the verification code
      console.log(`Send verification code ${code} to ${identifier}`);
    },
  },
})
```

**Endpoints:**
- `POST /auth/verify`: Accepts `{ code: "123456" }` (optionally the identifier). Marks the account verified. Rate-limited and locked like OTP.
- `POST /auth/verify/resend`: Re-sends the code (cooldown enforced). Returns success whether or not the account exists to prevent enumeration.

## 13) Register Hooks

`registerHooks` lets you mutate the registration payload or run side effects atomically with user creation — everything runs inside a transaction, so a throwing hook rolls back the whole registration.

```ts
AuthModule.forRoot({
  // ... other options
  registerHooks: {
    beforeRegister: async ({ payload, manager }) => {
      payload.displayName = `${payload.firstName} ${payload.lastName}`;
    },
    afterRegister: async ({ entity, userId, manager, assignRole }) => {
      await assignRole?.('member'); // role id or name
    },
  },
})
```

**Hook context** (`RegisterHookContext`): `payload` (mutable DTO — mutations flow into the saved user), `entity` + `userId` (afterRegister only), `manager` (transaction-scoped `EntityManager`), `assignRole` (afterRegister only; accepts a role id or name).

## 14) Multi-Identifier Login

`identifierFields` lets users log in with any of several fields (e.g. email OR phone):

```ts
AuthModule.forRoot({
  identifierField: 'email',
  identifierFields: ['email', 'phone'], // takes precedence over identifierField
  // ...
})
```

## 15) API Key Configuration

API key auth auto-registers admin endpoints. Configure via the `apiKey` option:

```ts
AuthModule.forRoot({
  // ... other options
  apiKey: {
    enabled: true,
    headerName: 'x-api-key', // default: 'x-api-key'
    keyPrefix: 'nuk_live_', // default: 'nuk_live_'
    hashRounds: 10, // bcrypt rounds, default: 10
  },
})
```

`JwtAuthGuard` automatically detects the API key header and delegates to `ApiKeyService` — no separate guard needed. Admin API-key endpoints (`POST /auth/api-keys`, etc.) are only registered when `apiKey.enabled: true`.

## 16) Public API Reference

**Guards**: `JwtAuthGuard`, `PermissionsGuard`, `RouteDisabledGuard`, `ApiKeyGuard`, `OnboardingJwtGuard`, `JwtStrategy`.

**Decorators**: `@Public()` / `IS_PUBLIC_KEY`, `@CurrentUser()`, `@Permissions(...)`, `@AuthOptions()` / `AUTH_OPTIONS`.

**Entities**: `RoleEntity`, `UserRoleEntity`, `ApiKeyEntity`, `ApiKeyRoleEntity`, `OnboardingAttemptEntity`.

**DTOs**: `CreateRoleDto`, `RolePermissionsDto`, `CreateApiKeyDto`.

**Helpers**: `resolvePermissions(user, rbac?)`, `resolvePermissionRegistry(registry?)`, `buildCrudPermissionsFromRegistry(registry, options)`.

**Key types**: `AuthModuleOptions`, `AuthOtpOptions`, `AuthPasswordResetOptions`, `AuthVerificationOptions`, `AuthOnboardingOptions`, `ApiKeyModuleOptions`, `AuthRbacOptions`, `AuthRegisterHooks`, `RegisterHook`, `RegisterHookContext`, `PermissionRegistryConfig`, `PermissionRegistryResource`, `ResolvedPermissionRegistry`, `PermissionEvaluationContext`, `OtpDeliveryPayload`, `OtpDeliveryCallback`, `AuthTokens`, `AuthUser`, `CreatedApiKey`, `ApiKeyListItem`, `OnboardingTokenPayload`.

**`AuthService` methods**: `register`, `login`, `requestOtp`, `loginWithOtp`, `refresh`, `logout`, `changePassword`, `requestPasswordReset`, `resetPassword`, `verifyAccount`, `resendVerificationCode`, `startOnboarding`, `completeOnboarding`, `createUserFromOnboarding`, `createRole`, `assignRoleToUser`, `assignPermissionsToRole`, `removePermissionsFromRole`, `removeRoleFromUser`, `getUserRoles`, `getAllRoles`, `validateUser`.

## 17) Help Notes

- `refresh` currently expects `refreshToken` in request body (or in the `refreshTokenHeaderName` header, default `x-refresh-token`).
- Access and refresh tokens are validated against hashed nonce values stored in DB, enabling single-session token rotation.
- If you enable RBAC, ensure `relations` include role relations needed during JWT validation.
- Use `disabledRoutes` to hard-disable selected auth endpoints (for example `['register', 'otp/request']`).
- `JwtAuthGuard` auto-detects `x-api-key` header — no need to add `ApiKeyGuard` separately.
- `superAdminPermission` in `rbac` config grants full access across all guarded routes.
- Defaults: `expiresIn` `'1h'`, `refreshTokenExpiresIn` `'7d'`, `onboardingTokenExpiresIn` `'15m'`.
- RBAC options also include `directPermissionsKey` (default `'permissions'`), `rolePermissionsKey` (default `'permissions'`), `requireAllPermissions` (default `true`, `false` = any match suffices), and `permissionEvaluator` for custom permission logic.
