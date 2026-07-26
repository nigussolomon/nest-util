# PLAN: Audit Merge into CRUD Module

## Overview

Merge `@nest-util/nest-audit` into `@nest-util/nest-crud` as a single module, eliminating the separate audit package while maintaining full backward compatibility through a re-export shim.

## Current Architecture

```
@nest-util/nest-audit (separate package)
├── NestUtilNestAuditModule (module)
├── AuditLogEntity (entity)
├── AuditService (service)
├── AuditInterceptor (interceptor)
├── @Audit() decorator
├── ListAuditLogsDto (DTO)
└── CreateAuditLogInput (interface)

@nest-util/nest-crud (separate package)
├── imports Audit from @nest-util/nest-audit
├── Uses @Audit() on create/update/remove endpoints
├── findAuditLogs() method in service
└── GET /auditlogs endpoint in controller
```

## Target Architecture

```
@nest-util/nest-crud (merged)
├── AuditLogEntity (entity, moved)
├── AuditService (service, moved)
├── AuditInterceptor (interceptor, moved)
├── @Audit() decorator (moved)
├── ListAuditLogsDto (DTO, moved)
├── CreateAuditLogInput (interface, moved)
└── All existing CRUD functionality

@nest-util/nest-audit (shim package - optional)
└── Re-exports everything from @nest-util/nest-crud
```

## Backward Compatibility Strategy

1. **Phase 1:** Move audit code to CRUD module
2. **Phase 2:** Create re-export shim in audit package
3. **Phase 3:** Deprecate audit package (optional removal later)

This ensures existing consumers can continue importing from `@nest-util/nest-audit` without changes.

---

## Implementation Steps

### Step 1: Move Audit Entity to CRUD Module

**Source:** `libs/nest-audit/src/lib/entities/audit-log.entity.ts`
**Destination:** `libs/nest-crud/src/lib/entities/audit-log.entity.ts`

**Create new file:** `libs/nest-crud/src/lib/entities/audit-log.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ nullable: true })
  tenantId?: string;

  @Index()
  @Column()
  action!: string;

  @Index()
  @Column({ nullable: true })
  entity?: string;

  @Index()
  @Column({ nullable: true })
  entityId?: string;

  @Index()
  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  ip?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
```

**Guardrail:** Verify entity compiles with TypeORM 1.1.0 decorators.

### Step 2: Move Audit Interface to CRUD Module

**Source:** `libs/nest-audit/src/lib/interfaces/audit-log.interface.ts`
**Destination:** `libs/nest-crud/src/lib/interfaces/audit-log.interface.ts`

**Create new file:** `libs/nest-crud/src/lib/interfaces/audit-log.interface.ts`

```typescript
export interface CreateAuditLogInput {
  action: string;
  tenantId?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}
```

**Guardrail:** No dependencies on other audit files.

### Step 3: Move Audit DTO to CRUD Module

**Source:** `libs/nest-audit/src/lib/dtos/list-audit-logs.dto.ts`
**Destination:** `libs/nest-crud/src/lib/dtos/list-audit-logs.dto.ts`

**Create new file:** `libs/nest-crud/src/lib/dtos/list-audit-logs.dto.ts`

```typescript
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAuditLogsDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601)' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601)' })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
```

**Guardrail:** Verify DTO validation still works with class-validator.

### Step 4: Move Audit Service to CRUD Module

**Source:** `libs/nest-audit/src/lib/services/audit-log.service.ts`
**Destination:** `libs/nest-crud/src/lib/services/audit-log.service.ts`

**Create new file:** `libs/nest-crud/src/lib/services/audit-log.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { CreateAuditLogInput } from '../interfaces/audit-log.interface';

interface FindAuditLogsOptions {
  entity?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>
  ) {}

  async log(input: CreateAuditLogInput): Promise<AuditLogEntity> {
    const entry = this.repo.create({
      action: input.action,
      tenantId: input.tenantId,
      entity: input.entity,
      entityId: input.entityId,
      userId: input.userId,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return this.repo.save(entry);
  }

  async logEntityAction(
    action: string,
    entity: string,
    entityId?: string,
    options?: Omit<CreateAuditLogInput, 'action' | 'entity' | 'entityId'>
  ) {
    return this.log({
      action,
      entity,
      entityId,
      ...options,
    });
  }

  async findAll(options: FindAuditLogsOptions = {}) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const queryBuilder = this.repo
      .createQueryBuilder('auditLog')
      .orderBy('auditLog.createdAt', 'DESC');

    if (options.entity) {
      queryBuilder.andWhere('auditLog.entity = :entity', {
        entity: options.entity,
      });
    }

    if (options.userId) {
      queryBuilder.andWhere('auditLog.userId = :userId', {
        userId: options.userId,
      });
    }

    if (options.startDate) {
      queryBuilder.andWhere('auditLog.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      queryBuilder.andWhere('auditLog.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
```

**Guardrail:** Verify `@InjectRepository(AuditLogEntity)` works with the moved entity.

### Step 5: Move Audit Decorator to CRUD Module

**Source:** `libs/nest-audit/src/lib/decorators/audit-log.decorator.ts`
**Destination:** `libs/nest-crud/src/lib/decorators/audit-log.decorator.ts`

**Create new file:** `libs/nest-crud/src/lib/decorators/audit-log.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'nest_util_audit';

export interface AuditOptions {
  action: string;
  entity?: string;
}

export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_METADATA_KEY, options);
```

**Guardrail:** No dependencies on other audit files.

### Step 6: Move Audit Interceptor to CRUD Module

**Source:** `libs/nest-audit/src/lib/interceptors/audit-log.interceptor.ts`
**Destination:** `libs/nest-crud/src/lib/interceptors/audit-log.interceptor.ts`

**Create new file:** `libs/nest-crud/src/lib/interceptors/audit-log.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuditService } from '../services/audit-log.service';
import {
  AUDIT_METADATA_KEY,
  AuditOptions,
} from '../decorators/audit-log.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditOptions = this.reflector.get<AuditOptions>(
      AUDIT_METADATA_KEY,
      context.getHandler()
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const controllerClass = context.getClass();

    const entityName = auditOptions.entity ?? this.resolveEntityName(controllerClass);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.auditService.log({
            action: auditOptions.action,
            entity: entityName,
            entityId: response?.id?.toString(),
            userId: user?.id?.toString(),
            ip: request.ip,
            userAgent: request.get('user-agent'),
            metadata: {
              body: request.body,
              params: request.params,
              query: request.query,
              response: response,
            },
          });
        } catch {
          // Silently fail audit logging to not break the main operation
        }
      })
    );
  }

  private resolveEntityName(controllerClass: Function): string {
    // Try to get entity name from metadata or fallback to class name
    const className = controllerClass.name;
    // Remove 'Controller' suffix if present
    return className.replace(/Controller$/, '') || 'Resource';
  }
}
```

**Guardrail:** Verify interceptor still resolves entity names correctly.

### Step 7: Move Audit Tests to CRUD Module

**Source:** `libs/nest-audit/src/lib/services/audit-log.service.spec.ts`
**Destination:** `libs/nest-crud/src/lib/services/audit-log.service.spec.ts`

**Source:** `libs/nest-audit/src/lib/interceptors/audit-log.interceptor.spec.ts`
**Destination:** `libs/nest-crud/src/lib/interceptors/audit-log.interceptor.spec.ts`

**Guardrail:** Update import paths in test files.

### Step 8: Update CRUD Module

**File:** `libs/nest-crud/src/lib/nest-crud.module.ts`

Add `TypeOrmModule.forFeature([AuditLogEntity])` to imports.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditService } from './services/audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService],
  exports: [AuditService],
})
export class NestCrudModule {}
```

**Guardrail:** Verify module can be imported by other modules.

### Step 9: Update CRUD Module Exports

**File:** `libs/nest-crud/src/index.ts`

Add exports for all moved audit files:

```typescript
// Existing exports
export * from './lib/nest-crud.module';
export * from './lib/services/nest-crud.service';
export * from './lib/controllers/nest-crud.controller';
export * from './lib/interfaces/crud.interface';
export * from './lib/dtos/pagination.dto';
export * from './lib/dtos/filter.dto';
export * from './lib/helpers/filter.helper';
export * from './lib/helpers/pagination.helper';
export * from './lib/helpers/exception-filter.helper';
export * from './lib/interceptors/response.interceptor';
export * from './lib/decorators/response-message.decorator';

// New audit exports (moved from nest-audit)
export * from './lib/entities/audit-log.entity';
export * from './lib/services/audit-log.service';
export * from './lib/interceptors/audit-log.interceptor';
export * from './lib/decorators/audit-log.decorator';
export * from './lib/interfaces/audit-log.interface';
export * from './lib/dtos/list-audit-logs.dto';
```

**Guardrail:** Verify all exports compile and are accessible.

### Step 10: Update CRUD Controller Imports

**File:** `libs/nest-crud/src/lib/controllers/nest-crud.controller.ts`

**Current code (line 18):**
```typescript
import { Audit, ListAuditLogsDto } from '@nest-util/nest-audit';
```

**Updated code:**
```typescript
import { Audit } from '../decorators/audit-log.decorator';
import { ListAuditLogsDto } from '../dtos/list-audit-logs.dto';
```

**Guardrail:** Verify controller compiles with new import paths.

### Step 11: Update CRUD Service Imports

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (line 3):**
```typescript
import { AuditLogEntity } from '@nest-util/nest-audit';
```

**Updated code:**
```typescript
import { AuditLogEntity } from '../entities/audit-log.entity';
```

**Guardrail:** Verify service compiles with new import path.

### Step 12: Update CRUD Interface

**File:** `libs/nest-crud/src/lib/interfaces/crud.interface.ts`

Add `AuditLogQuery` interface (currently imported from audit):

```typescript
export interface AuditLogQuery {
  user_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}
```

**Guardrail:** Verify interface matches the one previously exported from audit.

### Step 13: Update CRUD Package Dependencies

**File:** `libs/nest-crud/package.json`

Add `@nestjs/typeorm` as peer dependency (needed for `@InjectRepository`):

```json
{
  "peerDependencies": {
    "@nestjs/typeorm": "^11.0.0",
    "typeorm": "^1.1.0"
  }
}
```

**Guardrail:** Verify peer dependencies don't conflict with other libraries.

### Step 14: Update Demo-API Imports

**File:** `apps/demo-api/src/app/app.module.ts`

**Current code (lines 26-29):**
```typescript
import {
  NestUtilNestAuditModule,
  AuditInterceptor,
} from '@nest-util/nest-audit';
```

**Updated code:**
```typescript
import { AuditInterceptor } from '@nest-util/nest-crud';
```

**Current code (line 45):**
```typescript
NestUtilNestAuditModule,
```

**Remove this line** (audit is now part of CRUD module).

**Guardrail:** Verify app module compiles and starts correctly.

### Step 15: Update CRUD Package.json Dependencies

**File:** `libs/nest-crud/package.json`

Remove `@nest-util/nest-audit` from peer dependencies (no longer needed):

```json
{
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/swagger": "^11.2.6",
    "@nestjs/typeorm": "^11.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.3",
    "express": "^5.2.1",
    "typeorm": "^1.1.0",
    "rxjs": "^7.8.0"
  }
}
```

**Guardrail:** Verify no circular dependencies.

### Step 16: Create Re-export Shim for Backward Compatibility

**File:** `libs/nest-audit/src/index.ts`

Replace existing code with re-exports from CRUD:

```typescript
// Re-export everything from @nest-util/nest-crud for backward compatibility
export {
  AuditLogEntity,
  AuditService,
  AuditInterceptor,
  Audit,
  AUDIT_METADATA_KEY,
  AuditOptions,
  CreateAuditLogInput,
  ListAuditLogsDto,
} from '@nest-util/nest-crud';

// Re-export the module for backward compatibility
export { NestCrudModule as NestUtilNestAuditModule } from '@nest-util/nest-crud';
```

**Guardrail:** Verify existing consumers can still import from `@nest-util/nest-audit`.

### Step 17: Update Audit Package Dependencies

**File:** `libs/nest-audit/package.json`

Update to depend on CRUD package:

```json
{
  "peerDependencies": {
    "@nest-util/nest-crud": "workspace:*"
  }
}
```

**Guardrail:** Verify workspace dependency resolves correctly.

### Step 18: Remove Audit Source Files

After verifying everything works, delete the original audit source files:

```bash
rm -rf libs/nest-audit/src/lib/
```

Keep only:
- `libs/nest-audit/package.json`
- `libs/nest-audit/src/index.ts` (the shim)

**Guardrail:** Run full test suite before deleting.

---

## Acceptance Criteria

### Must Pass

- [ ] `npx nx run-many -t typecheck` passes with no errors
- [ ] `npx nx run-many -t lint` passes with no errors
- [ ] `npx nx run-many -t test` passes with all tests green
- [ ] `npx nx run-many -t build` produces valid dist output
- [ ] `npx nx serve demo-api` starts without errors
- [ ] Import from `@nest-util/nest-crud` works:
  ```typescript
  import { AuditLogEntity, AuditService, AuditInterceptor, Audit } from '@nest-util/nest-crud';
  ```
- [ ] Import from `@nest-util/nest-audit` still works (re-export shim):
  ```typescript
  import { AuditLogEntity, AuditService, AuditInterceptor, Audit } from '@nest-util/nest-audit';
  ```
- [ ] POST /post creates a post with audit log
- [ ] GET /post/auditlogs returns audit logs
- [ ] Audit interceptor logs CRUD operations
- [ ] No circular dependencies detected

### Should Pass

- [ ] All existing tests pass without modification
- [ ] No breaking changes for consuming applications
- [ ] Documentation updated to reflect new import paths
- [ ] Deprecation notice added to `@nest-util/nest-audit` README

### Nice to Have

- [ ] Bundle size does not increase by more than 5%
- [ ] No new `@ts-ignore` or `@ts-expect-error` comments needed
- [ ] All JSDoc comments remain accurate

---

## Rollback Plan

If critical issues arise:

1. Restore original audit source files from git
2. Restore original CRUD imports
3. Remove re-export shim
4. Run full test suite

```bash
git checkout -- libs/nest-audit/src/ libs/nest-crud/src/lib/controllers/nest-crud.controller.ts libs/nest-crud/src/lib/services/nest-crud.service.ts libs/nest-crud/src/index.ts apps/demo-api/src/app/app.module.ts
```

---

## Best Practices

### Query Performance

1. **Index verification:** Verify `AuditLogEntity` indexes are created correctly
2. **Query optimization:** Use `SELECT` instead of `SELECT *` for audit log queries
3. **Pagination:** Ensure `skip/take` is used correctly for large audit log tables

### Readability

1. **Import organization:** Group audit imports separately from CRUD imports
2. **Naming conventions:** Keep `Audit` prefix for audit-related classes
3. **Documentation:** Update README with new import paths

### Maintainability

1. **Deprecation notices:** Add `@deprecated` JSDoc to re-export shim
2. **Version bumping:** Consider major version bump for audit package
3. **Migration guide:** Create MIGRATION-AUDIT.md for consumers
