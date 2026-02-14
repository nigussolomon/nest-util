# `@nest-util/nest-auth`

`nest-auth` is a configurable authentication library for NestJS APIs that need JWT security without rigid schema assumptions.

## Feature summary

- Dynamic user entity support
- Configurable field mappings
- Register/login endpoint support
- Access + refresh token issuance
- Refresh token rotation strategy
- Decorators and guards for route-level control

---

## Module configuration

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

### Required settings

- `entity`: TypeORM user entity
- `jwtSecret`: access token signing secret
- `refreshSecret`: refresh token signing secret
- `fieldMap`: maps auth fields to your schema

---

## Route security model

Use these helpers:

- `@Public()` for anonymous routes
- JWT guard for protected routes
- `@CurrentUser()` to extract user payload

### Typical controller layout

- `POST /auth/register` (public)
- `POST /auth/login` (public)
- `POST /auth/refresh` (public with refresh token)
- protected business routes guarded by JWT

---

## Refresh token rotation flow

1. Client logs in and receives access + refresh tokens.
2. Client sends refresh token to refresh endpoint.
3. Server validates signature and nonce/version.
4. Server issues new access/refresh pair.
5. Previous refresh token becomes invalid.

This lowers replay risk if a refresh token leaks.

---

## Hardening checklist

- Keep access token expiry short
- Keep refresh token expiry longer but bounded
- Rotate JWT secrets periodically
- Store secrets in CI/environment vaults
- Hash refresh tokens at rest if possible
- Add rate limiting on auth endpoints
- Add account lockout / anomaly detection for brute-force patterns

---

## Custom DTO strategy

You can bring your own DTOs for:

- login payload shape
- register payload shape
- response schema consistency

This is useful when your API contracts require strict business-specific validation and OpenAPI examples.

---

## Operational recommendations

- Add logs for login success/failure and refresh events
- Avoid returning sensitive user fields by default
- Version your auth contracts as API evolves
- Add end-to-end tests for token rotation edge cases
