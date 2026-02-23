# `@nest-util/nest-audit` Step-by-Step Guide

This guide helps you add **structured audit logging** to your NestJS API in a simple, production-friendly way.

You will learn how to:

1. Install dependencies
2. Register the audit module
3. Log events from services
4. Use `@Audit(...)` with the interceptor
5. Query logs with filters + pagination
6. Apply operational best practices

---

## 1) Install dependencies

Install the audit package and TypeORM support:

```bash
pnpm add @nest-util/nest-audit typeorm
```

> If your project uses npm/yarn, use the equivalent install command.

### What this gives you

- `AuditService`: create and query audit entries
- `AuditLogEntity`: audit table model
- `Audit` decorator: declare auditable actions in controllers
- `AuditInterceptor`: captures request/response metadata automatically
- `AuditLogController`: built-in listing endpoint (`GET /audit-logs`)

---

## 2) Register the module in your app (DI setup)

Import `NestUtilNestAuditModule` in a module that already has TypeORM configured.

```ts
import { Module } from '@nestjs/common';
import { NestUtilNestAuditModule } from '@nest-util/nest-audit';

@Module({
  imports: [NestUtilNestAuditModule],
})
export class AppModule {}
```

### How dependency injection works here

When imported, the module registers:

- `AuditService` provider
- `AuditLogController`
- TypeORM repository for `AuditLogEntity`

That means you can inject `AuditService` anywhere inside module scope.

---

## 3) Log events directly from services

For explicit business-level logging, inject `AuditService`.

```ts
import { Injectable } from '@nestjs/common';
import { AuditService } from '@nest-util/nest-audit';

@Injectable()
export class InvoiceService {
  constructor(private readonly auditService: AuditService) {}

  async markPaid(invoiceId: string, userId: string) {
    // ... your business logic

    await this.auditService.logEntityAction('MARK_PAID', 'Invoice', invoiceId, {
      userId,
      metadata: { source: 'api' },
    });
  }
}
```

This is great for domain events that are not tied to one HTTP route.

---

## 4) Add route-level auditing with decorator + interceptor

### Step A: Decorate route handlers

```ts
import { Controller, Post, Param } from '@nestjs/common';
import { Audit } from '@nest-util/nest-audit';

@Controller('orders')
export class OrderController {
  @Post(':id/cancel')
  @Audit({ action: 'CANCEL_ORDER', entity: 'Order' })
  cancel(@Param('id') id: string) {
    return { ok: true, id };
  }
}
```

### Step B: Register interceptor globally (recommended)

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AuditInterceptor } from '@nest-util/nest-audit';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
```

With this in place, decorated handlers automatically log:

- action
- entity (explicit or inferred)
- user ID (if available on `request.user`)
- IP and user-agent
- request body, params, query, and handler response (inside metadata)

---

## 5) Use the built-in audit logs endpoint

`NestUtilNestAuditModule` exposes:

- `GET /audit-logs`

Supported query parameters:

- `entity`
- `user_id`
- `start_date` (ISO-8601)
- `end_date` (ISO-8601)
- `page` (default `1`)
- `limit` (default `10`)

### Example requests

```http
GET /audit-logs?page=1&limit=20
GET /audit-logs?entity=Order&user_id=u-123
GET /audit-logs?start_date=2026-01-01T00:00:00.000Z&end_date=2026-01-31T23:59:59.999Z
```

### Response shape

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

## 6) Audit data model (what gets stored)

Each audit log record includes fields such as:

- `action`
- `tenantId` (optional)
- `entity` and `entityId` (optional)
- `userId` (optional)
- `metadata` (JSON)
- `ip` and `userAgent` (optional)
- `createdAt`

This gives you both compliance-friendly traceability and debugging context.

---

## 7) Recommended usage patterns

- Use `@Audit(...)` on write operations (create/update/delete/state changes)
- Use `auditService.logEntityAction(...)` for background jobs and domain events
- Keep `action` names consistent (e.g., `CREATE_USER`, `UPDATE_PROFILE`)
- Avoid putting secrets/PII into `metadata`
- Use `tenantId` for multi-tenant systems

---

## 8) Production checklist

Before go-live:

- Protect `GET /audit-logs` with auth/role guards
- Add retention policy for old audit records
- Add indexes for high-volume filter fields (`entity`, `userId`, `createdAt`)
- Mask sensitive values before writing metadata
- Monitor write volume and database growth

---

## 9) Quick troubleshooting

### No logs are created from `@Audit(...)`

Check:

- Interceptor is registered (`APP_INTERCEPTOR` with `AuditInterceptor`)
- Decorator is present on the route handler
- Module importing is correct (`NestUtilNestAuditModule`)

### `userId` is empty in logs

Check:

- Auth guard runs before controller handler
- `request.user` actually contains an `id`

### `/audit-logs` query filters not working as expected

Check:

- `start_date` and `end_date` are valid ISO-8601 strings
- `page` and `limit` are positive integers

---

## 10) Copy/paste starter setup

```ts
@Module({
  imports: [NestUtilNestAuditModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
```

Then add `@Audit({ action: 'YOUR_ACTION', entity: 'YourEntity' })` to routes you want tracked.
