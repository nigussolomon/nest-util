# @nest-util/nest-auth

A dynamic NestJS authentication library designed to be flexible, plug-and-play, and easy to override. It uses the Provider Pattern to allow developers to configure user entities, field names, and security settings while providing custom DTOs for validation and documentation.

## Features

- **Flexible DTOs**: Provide your own `LoginDto`, `RegisterDto`, and `RefreshDto` to control validation and Swagger documentation.
- **Dynamic Field Mapping**: Map your User entity's fields (e.g., `email`, `password`, `refreshToken`) easily.
- **Type Safety**: Built-in `AuthUser` and `AuthTokens` types.
- **Single-Use Refresh Tokens**: Robust refresh token rotation logic to prevent replay attacks.
- **Profile Endpoint**: Built-in `/auth/me` to retrieve the current user profile.
- **API Key Authentication**: Server-to-server authentication with per-key RBAC. `JwtAuthGuard` auto-detects `x-api-key` header and delegates to `ApiKeyService`.
- **Super Admin Bypass**: Configure `superAdminPermission` in RBAC to grant full access across all guarded routes.

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

### Multiple Login Identifiers

Set `identifierFields` to allow a user to sign in (and request OTP / password reset) with **any** of several fields, e.g. `email` **or** `phone`. Lookups match against all configured fields, so the request body only needs the value under one of those keys. When both are provided, `identifierFields` takes precedence over `identifierField`.

```typescript
AuthModule.forRoot({
  // ...other options
  identifierField: 'email',                       // still required (fallback)
  identifierFields: ['email', 'phone'],           // optional; wins when set
  verification: {
    enabled: true,
    deliverCode: async ({ identifier, code }) => { /* send */ },
    identifierField: 'phone',                     // optional: which field to deliver post-register codes to
  },
});
```

- **Register**: conflict-check runs across every identifier present in the payload (duplicate email *or* phone is rejected). At least one identifier is required.
- **Login / OTP / password reset / verification**: the submitted value is matched against all identifier fields.
- **Tokens**: the JWT payload carries every identifier field present on the user.
- When verification is enabled and both identifiers are present, the code is delivered to the first identifier field in configured order, unless `verification.identifierField` pins a specific one (that field must be present in the registration payload).
- Add unique columns/indexes (e.g. `phone`) on your User entity for the new identifier fields.

### Registration Hooks

`registerHooks` lets you run `beforeRegister` and `afterRegister` logic atomically with user creation. Both hooks run inside the same database transaction as the user insert — if any hook throws, the registration rolls back (no orphan users, no half-applied role assignments).

```typescript
AuthModule.forRoot({
  // ...other options
  registerHooks: {
    beforeRegister: async ({ payload }) => {
      // Validate/transform the payload; mutations flow into the saved user.
      payload.name = payload.name?.trim();
    },
    afterRegister: async ({ userId, assignRole, manager }) => {
      // Assign roles by name or id. Throwing (e.g. role not found) fails registration.
      await assignRole('USER');
      // Or do arbitrary transactional work via the transaction-scoped `manager`.
    },
  },
});
```

Hook context:

| Field | beforeRegister | afterRegister |
|---|---|---|
| `payload` | Mutable registration DTO | Snapshot of the registration DTO |
| `entity` | — | Saved user entity |
| `userId` | — | Saved user id |
| `manager` | Transaction `EntityManager` | Transaction `EntityManager` |
| `assignRole(roleIdOrName)` | — | Assigns a role by id or name |

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

## API Key Authentication

Enable API key authentication for server-to-server requests. Each key has its own roles and permissions, independent of the user who created it. `JwtAuthGuard` auto-detects the `x-api-key` header and delegates to `ApiKeyService` — no need to add `ApiKeyGuard` separately.

### Configuration

```typescript
AuthModule.forRoot({
  // ... other options
  apiKey: {
    enabled: true,
    headerName: 'x-api-key',    // default
    keyPrefix: 'nuk_live_',      // default
    hashRounds: 10,              // default
  },
})
```

### Usage

```typescript
import { JwtAuthGuard, PermissionsGuard } from '@nest-util/nest-auth';

@Controller('data')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DataController {
  // API keys (x-api-key header) and JWT tokens (Bearer) both work
}
```

### API Key Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/api-keys` | Create new API key | Yes (JWT) |
| GET | `/auth/api-keys` | List user's API keys | Yes (JWT) |
| DELETE | `/auth/api-keys/:id` | Revoke API key | Yes (JWT) |
| POST | `/auth/api-keys/:id/roles/:roleId` | Assign role to key | Yes (JWT) |
| DELETE | `/auth/api-keys/:id/roles/:roleId` | Remove role from key | Yes (JWT) |

## Super Admin

Configure `superAdminPermission` in RBAC options. Users with this permission bypass all `@Permissions()` checks.

```typescript
AuthModule.forRoot({
  rbac: {
    superAdminPermission: 'admin.access',
  },
})
```

## User Management

Enable admin user lifecycle endpoints by adding a `userManagement` block to `AuthModule.forRoot`. Because the user entity is consumer-provided, the fields accepted on create/update are controlled by whitelists.

```typescript
AuthModule.forRoot({
  // ... other options
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

- New users default to `activeField = true`.
- Without `createFields`/`updateFields`, any key except sensitive fields (password, refresh/access tokens, OTP/verification/password-reset columns) is accepted; with a whitelist, unknown keys are rejected with `400`.
- Passwords are never returned by list/get responses and cannot be updated via `PATCH`.

### Self-service profile editing

`PATCH /auth/me` lets a user edit their own profile. The target user comes from the JWT (`@CurrentUser()`), never from the body, so ownership is enforced structurally. Guarded by `JwtAuthGuard` + `PermissionsGuard` with `profilePermission` (`'profile.edit'` by default) — assign it to a role so users can use it. Allowed keys come from `profileFields` (falls back to `updateFields`, then any non-sensitive key); password, the active flag, and sensitive columns are always rejected.

### User Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/users?page=1&limit=20&q=...&active=true` | Paginated user list | Yes (admin) |
| GET | `/auth/users/:id` | Fetch one user | Yes (admin) |
| POST | `/auth/users` | Create a user | Yes (admin) |
| PATCH | `/auth/users/:id` | Update allowed fields | Yes (admin) |
| POST | `/auth/users/:id/activate` | Activate a user | Yes (admin) |
| POST | `/auth/users/:id/deactivate` | Deactivate a user | Yes (admin) |
| DELETE | `/auth/users/:id` | Delete a user | Yes (admin) |
| PATCH | `/auth/me` | Update own profile | Yes (`profile.edit`) |

## Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and get tokens | No |
| POST | `/auth/refresh` | Get new access token | No (Refresh Token in Body) |
| GET  | `/auth/me` | Get current user profile | Yes (JWT) |
| POST | `/auth/update-password` | Update own password | Yes (JWT) |
| POST | `/auth/logout` | Logout user | Yes (JWT) |
| GET  | `/auth/me/permissions` | Get current user's resolved permissions | Yes (JWT) |
| GET  | `/auth/permissions` | Registered permission catalog | Yes (admin) |

## Development

- **Building**: `nx build nest-auth`
- **Testing**: `nx test nest-auth`
