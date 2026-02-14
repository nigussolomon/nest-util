# `@nest-util/nest-auth`

`nest-auth` is a configurable auth module for NestJS applications that need JWT auth without rigid schema constraints.

## Key capabilities

- Dynamic user entity configuration
- Login/register endpoints
- Access token + refresh token generation
- Refresh token rotation strategy
- Route protection decorators and guards

## Configure the module

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

## Secure routes

- Mark public routes with `@Public()`.
- Use default JWT auth guard for protected routes.
- Read authenticated user with `@CurrentUser()`.

## Refresh token flow

1. User logs in and receives access + refresh tokens.
2. Refresh endpoint validates token signature and nonce.
3. Server rotates refresh token and invalidates previous token.
4. Client stores new token pair.

## Hardening recommendations

- Use short access token TTL and longer refresh TTL.
- Store refresh tokens server-side as hashed values when possible.
- Rotate secrets through CI-managed environment variables.
- Enforce rate limiting and account lockouts at API gateway level.
