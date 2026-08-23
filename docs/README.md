# Nest Util Documentation

This is the starting point for everything in the repository. Each guide below
matches the current source code and the run-ready demo app.

## Read this first

1. [Quick start](./../README.md#quick-start) — the shortest path to a working CRUD + auth app.
2. [demo-api setup](./demo-api/README.md) — a complete, runnable reference of all packages wired together.

## Package guides

| Package | Guide |
|---|---|
| `@nest-util/nest-crud` | [nest-crud](./nest-crud/README.md) — CRUD, pagination, filtering, hooks, ownership, status/approval pipelines, audit logging, testing |
| `@nest-util/nest-auth` | [nest-auth](./nest-auth/README.md) — auth, RBAC, API keys, OTP, password reset, onboarding, user management |
| `@nest-util/nest-error` | [nest-error](./../libs/nest-error/README.md) — standardized, localized error responses (required peer) |
| `@nest-util/nest-file` | [nest-file](./nest-file/README.md) — S3/MinIO-compatible file uploads |
| `@nest-util/nest-notify` | [nest-notify](./nest-notify/README.md) — FCM push + SMTP email + WebSocket |
| `@nest-util/nest-payment` | [nest-payment](./nest-payment/README.md) — checkout, subscriptions, refunds, webhooks |

## Recommended integration order

If you are adding every package to one NestJS app, this order keeps the
dependencies simple:

1. Configure TypeORM with `autoLoadEntities: true`.
2. Register `LocalizationModule.forRoot(...)` for consistent errors.
3. Add `AuthModule.forRoot(...)` for authentication and permissions.
4. Build resource services with `NestCrudService`.
5. Build resource controllers with `CreateNestedCrudController(...)`.
6. Add `NestFileModule.forRoot(...)` for file uploads.
7. Add `NestPaymentModule.forRoot(...)` with your payment provider.
8. Add `NestNotifyModule.forRoot(...)` for push and email notifications.
9. Apply the global validation, query parser, interceptor, and Swagger setup shown
   in the [demo-api guide](./demo-api/README.md).

---

## Upgrading an existing app

- **[MIGRATION-GUIDE.md](./../MIGRATION-GUIDE.md)** — phased upgrade for consumer projects.
- **[MIGRATION-GUIDE-0.0.1.md](./../MIGRATION-GUIDE-0.0.1.md)** — upgrade from the `0.0.1`-era pin.
- **[MIGRATION-APPROVAL-PIPELINE.md](./../MIGRATION-APPROVAL-PIPELINE.md)** — `pending` → `draft → submitted` data migration.
- **[NEST-ERROR-MIGRATION-GUIDE.md](./../NEST-ERROR-MIGRATION-GUIDE.md)** — adopt the standardized error system.
