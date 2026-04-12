# nest-audit Setup Guide

This guide is based on `libs/nest-audit`.

## 1) Install

```bash
pnpm add @nest-util/nest-audit
```

## 2) Register Module

Import `NestUtilNestAuditModule` in your root module:

```ts
import { Module } from '@nestjs/common';
import { NestUtilNestAuditModule } from '@nest-util/nest-audit';

@Module({
  imports: [NestUtilNestAuditModule],
})
export class AppModule {}
```

This registers TypeORM support for `AuditLogEntity` and exports `AuditService`.

## 3) Enable Audit Interceptor Globally

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
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

## 4) Add `@Audit` to Mutating Endpoints

```ts
import { Controller, Post, Body } from '@nestjs/common';
import { Audit } from '@nest-util/nest-audit';

@Controller('posts')
export class PostController {
  @Post()
  @Audit({ action: 'CREATE', entity: 'Post' })
  create(@Body() dto: unknown) {
    return { ok: true, dto };
  }
}
```

`AuditInterceptor` logs only handlers that have `@Audit(...)` metadata.

## 5) Use `AuditService` Directly (Optional)

```ts
import { Injectable } from '@nestjs/common';
import { AuditService } from '@nest-util/nest-audit';

@Injectable()
export class BillingService {
  constructor(private readonly auditService: AuditService) {}

  async issueRefund(orderId: string, userId: string) {
    // business logic...

    await this.auditService.logEntityAction('REFUND', 'Order', orderId, {
      userId,
      metadata: { source: 'billing-service' },
    });
  }
}
```

## 6) Stored Audit Fields

`AuditLogEntity` stores:

- `action`
- `entity`, `entityId`
- `userId`, `tenantId`
- `metadata` (JSONB)
- `ip`, `userAgent`
- `createdAt`

## 7) Help Notes

- If `entity` is omitted in `@Audit`, interceptor tries to resolve it from controller metadata; fallback is `Resource`.
- In the demo app, CRUD generated handlers (`create`, `update`, `delete`) are already decorated with `@Audit(...)` inside `CreateNestedCrudController`.
- Verify your DB user has permission to create and write the `audit_logs` table.
