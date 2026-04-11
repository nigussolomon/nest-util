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

## RBAC (Role-Based Access Control)

`@nest-util/nest-auth` now supports a simple static/hybrid RBAC strategy using normalized permissions in the format:

- `resource:action` (examples: `posts:read`, `users:write`)

### RBAC module options

```ts
AuthModule.forRoot({
  // existing options...
  rbac: {
    enabled: true,
    rolesField: 'roles',
    permissionsField: 'permissions',
    denyByDefault: true,
    rolePermissions: {
      admin: ['users:read', 'users:write', 'posts:read', 'posts:write'],
      editor: ['posts:read', 'posts:write'],
      viewer: ['posts:read'],
    },
  },
});
```

### Route decorators

- `@RequirePermissions(...permissions)` for explicit route permissions
- `@AllowRoles(...roles)` for role shortcut access
- `@AllowAnyPermission()` to bypass deny-by-default for selected protected routes

Example:

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('posts:read')
@Get()
findAll() {}
```

### Migration notes

- Existing auth-only setups remain compatible: RBAC is optional.
- To enforce RBAC globally on protected routes, set `rbac.enabled = true` and `denyByDefault = true`, then annotate routes with RBAC metadata.
- Keep sensitive data handling unchanged: password/token fields are still removed from auth responses.

## Development

- **Building**: `nx build nest-auth`
- **Testing**: `nx test nest-auth`
