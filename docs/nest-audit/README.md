# nest-audit Setup Guide

> **Note:** `@nest-util/nest-audit` has been merged into `@nest-util/nest-crud`. The separate package no longer exists.

All audit functionality is now part of `@nest-util/nest-crud`:

- `Audit` decorator
- `AuditInterceptor`
- `AuditService`
- `AuditLogEntity`
- `ListAuditLogsDto`
- `CreateAuditLogInput`

## Migration

Replace all imports from `@nest-util/nest-audit` with `@nest-util/nest-crud`:

```diff
- import { Audit } from '@nest-util/nest-audit';
+ import { Audit } from '@nest-util/nest-crud';

- import { AuditInterceptor } from '@nest-util/nest-audit';
+ import { AuditInterceptor } from '@nest-util/nest-crud';

- import { NestUtilNestAuditModule } from '@nest-util/nest-audit';
+ // DELETE: NestCrudModule now provides AuditService and registers AuditLogEntity
```

Remove `NestUtilNestAuditModule` from your module imports. `NestCrudModule` alone is sufficient.

See [MIGRATION-GUIDE.md](../../MIGRATION-GUIDE.md) for the full migration guide.

## Usage

```ts
import { Audit, AuditInterceptor, NestCrudModule } from '@nest-util/nest-crud';

@Module({
  imports: [NestCrudModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
```

### Manual `@Audit` Decoration

```ts
@Post()
@Audit({ action: 'CREATE', entity: 'Post' })
create(@Body() dto: CreatePostDto) { ... }
```

### Using `AuditService` Directly

```ts
import { AuditService } from '@nest-util/nest-crud';

@Injectable()
export class BillingService {
  constructor(private readonly auditService: AuditService) {}

  async issueRefund(orderId: string, userId: string) {
    await this.auditService.logEntityAction('REFUND', 'Order', orderId, {
      userId,
      metadata: { source: 'billing-service' },
    });
  }
}
```

### Stored Fields

`AuditLogEntity` stores: `action`, `entity`, `entityId`, `userId`, `tenantId`, `metadata` (JSONB), `ip`, `userAgent`, `createdAt`.

### CRUD Integration

CRUD controller factory auto-decorates `create`, `update`, `remove` with `@Audit()`. `NestCrudService.findAuditLogs()` queries audit logs filtered by entity name.
