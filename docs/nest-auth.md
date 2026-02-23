# `@nest-util/nest-auth` Step-by-Step Guide

This guide is designed for **new NestJS developers** who want to add authentication quickly, correctly, and with confidence.

You will learn how to:

1. Install dependencies
2. Prepare your `User` entity
3. Configure `NestAuthModule` with dependency injection
4. Use built-in auth endpoints (`register`, `login`, `refresh`)
5. Protect your own routes with guards + decorators
6. Understand refresh token rotation
7. Apply production hardening best practices

---

## 1) Install dependencies

Install the package and common auth dependencies:

```bash
pnpm add @nest-util/nest-auth @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt typeorm
```

> If your project uses npm/yarn, use the equivalent install command.

### Why these packages?

- `@nest-util/nest-auth`: auth module, controller, service, guards, decorators
- `@nestjs/jwt`: token generation and validation
- `passport` + `passport-jwt`: JWT strategy + guard integration
- `bcrypt`: password hashing
- `typeorm`: entity support for user persistence

---

## 2) Create (or verify) your `User` entity

`nest-auth` supports dynamic field mapping. That means your user table can use your own names (for example, `email` instead of `username`).

Example:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  refreshToken?: string;
}
```

### Minimum fields you should have

- Unique login field (commonly `email` or `username`)
- Password field
- Refresh token field (nullable)

---

## 3) Configure `NestAuthModule` in your app module (DI setup)

This is the most important step.

In your `AppModule` (or `AuthFeatureModule`), register `NestAuthModule.forRoot(...)` and pass your entity + secrets + field mapping.

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthModule } from '@nest-util/nest-auth';
import { User } from './user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    NestAuthModule.forRoot({
      entity: User,
      jwtSecret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      fieldMap: {
        username: 'email',
        password: 'password',
        refreshToken: 'refreshToken',
      },
    }),
  ],
})
export class AppModule {}
```

### How dependency injection works here

When you call `NestAuthModule.forRoot(...)`, the module internally wires providers like:

- Auth service (business logic)
- JWT strategy
- Route guard(s)
- Configuration token(s)

NestJS DI then makes those providers available to controllers and modules that import `NestAuthModule`.

### Common DI mistakes to avoid

- Missing `TypeOrmModule.forFeature([User])` in the same module scope
- Missing environment variables (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- Wrong `fieldMap` keys (must point to real columns on your entity)

---

## 4) Use built-in authentication endpoints

After module setup, you get a standard auth flow:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

### Typical flow for frontend/client apps

1. User registers or logs in.
2. API returns:
   - short-lived access token
   - longer-lived refresh token
3. Client uses access token on protected API routes.
4. On access token expiry, client calls `/auth/refresh` with refresh token.
5. API rotates refresh token and returns a new token pair.

---

## 5) Protect your own routes

Use decorators and guards to define which routes require authentication.

### Public route example

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '@nest-util/nest-auth';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  ping() {
    return { ok: true };
  }
}
```

### Protected route + current user example

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@nest-util/nest-auth';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  @Get()
  getMe(@CurrentUser() user: { userId: string; username: string }) {
    return { message: 'Authenticated', user };
  }
}
```

### Dependency injection in your own services

If you need auth logic in custom services, inject Nest-auth services/providers the same NestJS way via constructor injection (and ensure the module that provides them is imported).

---

## 6) Refresh token rotation explained simply

Refresh token rotation means every refresh call invalidates the previous refresh token.

Why this matters:

- If an old refresh token is stolen, replay is harder
- Session security is improved by design

Basic sequence:

1. Login returns `accessToken` + `refreshToken`.
2. Client sends `refreshToken` to `/auth/refresh`.
3. Server validates and issues new token pair.
4. Old refresh token is no longer valid.

---

## 7) Recommended project structure for beginners

A simple structure that stays clear as your app grows:

```text
src/
  app.module.ts
  auth/
    auth.module.ts
  user/
    user.entity.ts
    user.module.ts
  profile/
    profile.controller.ts
```

Keep auth setup centralized, and import the auth module where needed.

---

## 8) Production hardening checklist

Before going live, make sure to:

- Use strong secrets from environment/secret manager
- Keep access token expiry short
- Keep refresh token expiry bounded
- Enable rate limiting on auth routes
- Log login failures and refresh events
- Avoid returning sensitive fields (`password`, raw refresh token)
- Consider hashing refresh tokens before storage
- Add e2e tests for login + refresh + token expiry behavior

---

## 9) Quick troubleshooting

### 401 Unauthorized on protected route

Check:

- `Authorization: Bearer <token>` header is present
- Access token is valid and not expired
- Route is not accidentally marked `@Public()`

### Login works but refresh fails

Check:

- `refreshSecret` matches the secret used for signing
- `fieldMap.refreshToken` points to the correct entity column
- Refresh token rotation logic isn’t being bypassed by custom code

### Module boots but auth endpoints are missing

Check:

- `NestAuthModule.forRoot(...)` is actually in `imports`
- No module import circular dependency is breaking initialization

---

## 10) Copy/paste starter configuration

Use this as your first version, then customize:

```ts
NestAuthModule.forRoot({
  entity: User,
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  fieldMap: {
    username: 'email',
    password: 'password',
    refreshToken: 'refreshToken',
  },
});
```

If you start with the structure above, most teams can integrate secure authentication in a clean, maintainable way very quickly.
