# nest-auth Setup Guide

This guide is based on the current implementation in `libs/nest-auth`.

## 1) Install

If you consume published artifacts:

```bash
pnpm add @nest-util/nest-auth
```

Inside this monorepo/demo app, the workspace package is already available.

## 2) Prepare Requirements

1. Ensure TypeORM is configured.
2. Ensure your `User` entity includes fields for:
   - identifier (for example `email`)
   - password field (for example `password`)
   - refresh token hash field (default `refreshToken`)
   - access token hash field (default `accessToken`)
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

## 7) Help Notes

- `refresh` currently expects `refreshToken` in request body.
- Access and refresh tokens are validated against hashed nonce values stored in DB, enabling single-session token rotation.
- If you enable RBAC, ensure `relations` include role relations needed during JWT validation.
- Use `disabledRoutes` to hard-disable selected auth endpoints (for example `['register']`).
