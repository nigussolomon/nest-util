# PLAN: Consolidated Execution Plan

## Overview

This is the master execution plan coordinating four feature implementations across the `@nest-util` monorepo. Plans must be executed sequentially in the order below due to dependency chains.

## Dependency Graph

```
Phase 1: TypeORM Upgrade (0.3.28 → 1.1.0)
  └─ Foundation — all other plans operate on TypeORM code

Phase 2: Audit Merge (nest-audit → nest-crud)
  └─ Eliminates nest-audit peerDep from nest-crud
  └─ Hooks plan's code samples assume local audit imports

Phase 3: Before/After Hooks (NestCrudService)
  └─ Modifies service methods and CrudServiceOptions
  └─ FindMine's findMine() will want hook support

Phase 4: FindMine (GET /mine endpoint)
  └─ Adds new method on top of hooks-modified service
  └─ Introduces optional nest-auth peerDep in nest-crud
```

---

## Phase 1: TypeORM Upgrade (0.3.28 → 1.1.0)

**Risk:** Medium — version bumps, API compatibility check required
**Duration estimate:** ~30 minutes
**Rollback:** `git checkout -- package.json libs/*/package.json && pnpm install`

### Step 1.1: Update Root Dependency

**File:** `package.json` (line 65)

```diff
- "typeorm": "^0.3.28"
+ "typeorm": "^1.1.0"
```

### Step 1.2: Update Library Peer Dependencies

| File | Line | Change |
|------|------|--------|
| `libs/nest-crud/package.json` | 31 | `"typeorm": "^0.3.28"` → `"typeorm": "^1.1.0"` |
| `libs/nest-auth/package.json` | 34 | `"typeorm": "^0.3.28"` → `"typeorm": "^1.1.0"` |
| `libs/nest-audit/package.json` | 31 | `"typeorm": "^0.3.28"` → `"typeorm": "^1.1.0"` |

### Step 1.3: Install & Resolve

```bash
pnpm install
```

**Guardrail:** Check for peer dependency conflicts in output.

### Step 1.4: Run TypeORM Codemod

```bash
npx typeorm-codemod
```

**What this automates:**
- Renames `connection` → `dataSource` in metadata
- Detects removed APIs and suggests replacements
- Updates import paths where needed

**Guardrail:** Review all diffs before committing. The codebase uses none of the removed v1.0 APIs (`findByIds`, `findOneById`, `AbstractRepository`, `getCustomRepository`).

### Step 1.5: Fix ormconfig.ts

**File:** `apps/demo-api/src/db/ormconfig.ts`

Remove `entitySkipConstructor: true` (line 115) if deprecated in TypeORM 1.0. The `DataSource` import and constructor pattern are already v1-compatible.

### Step 1.6: Verify Decorators

All standard decorators remain compatible: `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@Index`, `@CreateDateColumn`, `@UpdateDateColumn`, `@ManyToOne`, `@OneToMany`, `@JoinColumn`.

No `@RelationCount` usage found — safe.

### Step 1.7: Verify QueryBuilder & Repository Patterns

| Pattern | File | Status |
|---------|------|--------|
| `@InjectRepository()` | nest-crud, nest-audit | Compatible |
| `DataSource.getRepository()` | nest-auth (line 59-63) | Compatible |
| `repo.create()`, `repo.save()`, `repo.findOne()` | Multiple | Compatible |
| `repo.createQueryBuilder()` | filter.helper.ts, pagination.helper.ts | Compatible |
| `QueryFailedError` | exception-filter.helper.ts (line 7) | Compatible |

### Checkpoint 1: Validation

```bash
npx nx run-many -t typecheck
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
```

**Must pass all four before proceeding to Phase 2.**

### Commit Point 1

```bash
git add -A
git commit -m "chore: upgrade typeorm from 0.3.28 to 1.1.0"
```

---

## Phase 2: Audit Merge (nest-audit → nest-crud)

**Risk:** Medium — import path changes, module registration changes
**Duration estimate:** ~45 minutes
**Rollback:** `git checkout -- libs/nest-audit/src/ libs/nest-crud/src/ libs/nest-crud/src/index.ts apps/demo-api/src/app/app.module.ts`

### Step 2.1: Create Destination Directories

```bash
mkdir -p libs/nest-crud/src/lib/entities
mkdir -p libs/nest-crud/src/lib/interfaces
mkdir -p libs/nest-crud/src/lib/dtos
mkdir -p libs/nest-crud/src/lib/decorators
mkdir -p libs/nest-crud/src/lib/interceptors
```

### Step 2.2: Move Audit Entity

**Source:** `libs/nest-audit/src/lib/entities/audit-log.entity.ts`
**Destination:** `libs/nest-crud/src/lib/entities/audit-log.entity.ts`

Copy verbatim. No import changes needed (all typeorm decorators).

### Step 2.3: Move Audit Interface

**Source:** `libs/nest-audit/src/lib/interfaces/audit-log.interface.ts`
**Destination:** `libs/nest-crud/src/lib/interfaces/audit-log.interface.ts`

Copy verbatim.

### Step 2.4: Move Audit DTO

**Source:** `libs/nest-audit/src/lib/dtos/list-audit-logs.dto.ts`
**Destination:** `libs/nest-crud/src/lib/dtos/list-audit-logs.dto.ts`

Copy verbatim.

### Step 2.5: Move Audit Decorator

**Source:** `libs/nest-audit/src/lib/decorators/audit-log.decorator.ts`
**Destination:** `libs/nest-crud/src/lib/decorators/audit-log.decorator.ts`

Copy verbatim.

### Step 2.6: Move Audit Service

**Source:** `libs/nest-audit/src/lib/services/audit-log.service.ts`
**Destination:** `libs/nest-crud/src/lib/services/audit-log.service.ts`

Update internal imports to use relative paths:
```diff
- import { AuditLogEntity } from '@nest-util/nest-audit';
+ import { AuditLogEntity } from '../entities/audit-log.entity';
- import { CreateAuditLogInput } from '@nest-util/nest-audit';
+ import { CreateAuditLogInput } from '../interfaces/audit-log.interface';
```

### Step 2.7: Move Audit Interceptor

**Source:** `libs/nest-audit/src/lib/interceptors/audit-log.interceptor.ts`
**Destination:** `libs/nest-crud/src/lib/interceptors/audit-log.interceptor.ts`

Update internal imports to relative paths.

### Step 2.8: Move Audit Tests

**Source:** `libs/nest-audit/src/lib/services/audit-log.service.spec.ts`
**Destination:** `libs/nest-crud/src/lib/services/audit-log.service.spec.ts`

**Source:** `libs/nest-audit/src/lib/interceptors/audit-log.interceptor.spec.ts`
**Destination:** `libs/nest-crud/src/lib/interceptors/audit-log.interceptor.spec.ts`

Update import paths in test files.

### Step 2.9: Update CRUD Module

**File:** `libs/nest-crud/src/lib/nest-crud.module.ts`

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

### Step 2.10: Update CRUD Index Exports

**File:** `libs/nest-crud/src/index.ts`

Add new audit exports:
```typescript
export * from './lib/entities/audit-log.entity';
export * from './lib/services/audit-log.service';
export * from './lib/interceptors/audit-log.interceptor';
export * from './lib/decorators/audit-log.decorator';
export * from './lib/interfaces/audit-log.interface';
export * from './lib/dtos/list-audit-logs.dto';
```

### Step 2.11: Update CRUD Controller Imports

**File:** `libs/nest-crud/src/lib/controllers/nest-crud.controller.ts` (line 18)

```diff
- import { Audit, ListAuditLogsDto } from '@nest-util/nest-audit';
+ import { Audit } from '../decorators/audit-log.decorator';
+ import { ListAuditLogsDto } from '../dtos/list-audit-logs.dto';
```

### Step 2.12: Update CRUD Service Imports

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (line 3)

```diff
- import { AuditLogEntity } from '@nest-util/nest-audit';
+ import { AuditLogEntity } from '../entities/audit-log.entity';
```

### Step 2.13: Update CRUD Interface

**File:** `libs/nest-crud/src/lib/interfaces/crud.interface.ts`

Add `AuditLogQuery` interface (currently imported from audit).

### Step 2.14: Update CRUD Package Dependencies

**File:** `libs/nest-crud/package.json`

Remove `@nest-util/nest-audit` from peerDependencies. Add `@nestjs/typeorm` as peerDependency (needed for `@InjectRepository`).

### Step 2.15: Create Re-export Shim

**File:** `libs/nest-audit/src/index.ts`

```typescript
// Re-export everything from @nest-util/nest-crud for backward compatibility
// @deprecated Use @nest-util/nest-crud directly instead
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

export { NestCrudModule as NestUtilNestAuditModule } from '@nest-util/nest-crud';
```

### Step 2.16: Update Audit Package Dependencies

**File:** `libs/nest-audit/package.json`

Add `@nest-util/nest-crud: workspace:*` as dependency. Remove all other dependencies that are now provided by nest-crud.

### Step 2.17: Remove Audit Source Files

```bash
rm -rf libs/nest-audit/src/lib/
```

Keep only:
- `libs/nest-audit/package.json`
- `libs/nest-audit/src/index.ts` (the shim)

### Step 2.18: Update Demo-API Imports

**File:** `apps/demo-api/src/app/app.module.ts`

```diff
- import { NestUtilNestAuditModule, AuditInterceptor } from '@nest-util/nest-audit';
+ import { AuditInterceptor } from '@nest-util/nest-crud';
```

Remove `NestUtilNestAuditModule` from module imports (line 45). Audit is now part of CRUD module.

### Checkpoint 2: Validation

```bash
npx nx run-many -t typecheck
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
```

**Functional tests:**
- POST /post creates a post with audit log
- GET /post/auditlogs returns audit logs
- Import from `@nest-util/nest-crud` works: `import { AuditLogEntity, AuditService, AuditInterceptor } from '@nest-util/nest-crud'`
- Import from `@nest-util/nest-audit` still works (re-export shim)

### Commit Point 2

```bash
git add -A
git commit -m "feat(crud): merge audit module into crud package

- Move AuditLogEntity, AuditService, AuditInterceptor, Audit decorator,
  ListAuditLogsDto, and CreateAuditLogInput to nest-crud
- Create re-export shim in nest-audit for backward compatibility
- Remove nest-audit peer dependency from nest-crud"
```

---

## Phase 3: Before/After Transaction Hooks

**Risk:** Low-Medium — additive, backward compatible
**Duration estimate:** ~45 minutes
**Rollback:** `git checkout -- libs/nest-crud/src/lib/services/nest-crud.service.ts && rm libs/nest-crud/src/lib/interfaces/hooks.interface.ts`

### Step 3.1: Create Hook Types File

**Create new file:** `libs/nest-crud/src/lib/interfaces/hooks.interface.ts`

Contains:
- `CrudHook<TContext>` — function signature
- `CrudHookConfig<TContext>` — handler + transaction flag
- Context types: `BeforeCreateContext`, `AfterCreateContext`, `BeforeUpdateContext`, `AfterUpdateContext`, `BeforeRemoveContext`, `AfterRemoveContext`, `BeforeFindOneContext`, `AfterFindOneContext`
- `CrudHooks<TEntity, TCreateDto, TUpdateDto>` — full hooks interface
- `TransactionConfig` — isolation level + timeout

**Guardrail:** Pure type definitions, no dependencies on other CRUD files.

### Step 3.2: Update Service Options Interface

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (lines 10-24)

Add to `CrudServiceOptions`:
```typescript
hooks?: CrudHooks<Entity, any, any>;
transactionConfig?: TransactionConfig;
```

**Guardrail:** All new fields are optional — no breaking changes.

### Step 3.3: Add Transaction Helper Methods

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

Add private methods:
1. `executeInTransaction<T>(fn, isolationLevel)` — creates QueryRunner, starts transaction, commits/rollbacks
2. `executeHook<TContext>(hook, context)` — executes hook with optional transaction support

**Guardrail:** Private methods only — no API surface changes.

### Step 3.4: Update Constructor

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (lines 50-60)

Add fields:
```typescript
protected readonly hooks: CrudHooks<Entity, any, any>;
protected readonly transactionConfig: TransactionConfig;
```

Initialize from options with defaults (`{}`).

### Step 3.5: Update create() Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (lines 150-160)

Add before/after hook calls:
```typescript
async create(payload: CreateDto): Promise<ResponseDto> {
  await this.executeHook(this.hooks.beforeCreate, { payload });
  // ... existing logic ...
  const result = this.toResponseDto ? ... : entity;
  await this.executeHook(this.hooks.afterCreate, { entity, payload });
  return result;
}
```

### Step 3.6: Update update() Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (lines 162-179)

Add before/after hook calls with entity context.

### Step 3.7: Update remove() Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (lines 181-189)

Pre-fetch entity for hook context, then add before/after hook calls.

### Step 3.8: Update findOne() Method (Optional)

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts` (lines 135-148)

Add before/after hook calls (read-only, no transaction needed).

### Step 3.9: Export Hook Types

**File:** `libs/nest-crud/src/index.ts`

```typescript
export * from './lib/interfaces/hooks.interface';
```

### Step 3.10: Write Unit Tests

**Create new file:** `libs/nest-crud/src/lib/services/nest-crud.service.hooks.spec.ts`

Tests for:
- beforeCreate hook executes before entity save
- afterCreate hook executes after entity save
- beforeUpdate/afterUpdate hooks
- beforeRemove/afterRemove hooks
- Transactional hooks roll back on failure
- Non-transactional hooks execute independently
- Multiple hooks execute in order
- No hooks = backward compatible behavior

### Checkpoint 3: Validation

```bash
npx nx run-many -t typecheck
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
```

**Functional tests:**
- Existing CRUD operations work without hooks (backward compatible)
- Demo API starts and CRUD operations succeed

### Commit Point 3

```bash
git add -A
git commit -m "feat(crud): add before/after transaction hooks

- Add CrudHooks interface with before/after hooks for create, update,
  remove, and findOne operations
- Add TransactionConfig with configurable isolation levels
- Hooks are optional and backward compatible
- Support transactional and non-transactional hook execution"
```

---

## Phase 4: FindMine Endpoint

**Risk:** Medium — introduces optional nest-auth peerDep, conditional endpoint registration
**Duration estimate:** ~60 minutes
**Rollback:** `git checkout -- libs/nest-crud/src/ apps/demo-api/src/app/post/`

### Step 4.1: Create FindMine Interface

**Create new file:** `libs/nest-crud/src/lib/interfaces/find-mine.interface.ts`

Contains:
- `FindMineConfig<TEntity>` — configuration for findMine feature
- `FindMineQueryFunction<TEntity>` — custom query builder function type

### Step 4.2: Update CrudServiceOptions

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

Add to `CrudServiceOptions`:
```typescript
userOwnershipField?: keyof Entity;
findMineQuery?: FindMineQueryFunction<Entity>;
```

### Step 4.3: Add findMine() Method to Service

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

Add new method:
```typescript
async findMine(
  user: AuthUser,
  query: PaginationDto & FilterDto
): Promise<{ data: ResponseDto[]; meta: PaginationMeta }> {
  // Build query using userOwnershipField or custom findMineQuery
  // Apply filters, pagination, sorting
  // Return paginated results
}
```

**Import `AuthUser` from `@nest-util/nest-auth`** (types only, no runtime dependency).

### Step 4.4: Update CrudInterface

**File:** `libs/nest-crud/src/lib/interfaces/crud.interface.ts`

Add `'findMine'` to `CrudEndpoint` type.

### Step 4.5: Update Controller Factory Options

**File:** `libs/nest-crud/src/lib/controllers/nest-crud.controller.ts`

Add to `CrudControllerFactoryOptions`:
```typescript
enableFindMine?: boolean;
```

### Step 4.6: Add findMine Endpoint to Controller

**File:** `libs/nest-crud/src/lib/controllers/nest-crud.controller.ts`

Add endpoint:
```typescript
@Get('mine')
async findMine(@CurrentUser() user: AuthUser, @Query() query: PaginationDto & FilterDto) {
  return this.service.findMine(user, query);
}
```

**Route ordering:** Place before `/:id` to avoid route conflicts.

**Guardrail:** Only register when `enableFindMine: true`. Guards inherited from consumer controller class.

### Step 4.7: Add nest-auth as Optional Peer Dependency

**File:** `libs/nest-crud/package.json`

```json
"peerDependencies": {
  "@nest-util/nest-auth": "workspace:*"
},
"peerDependenciesMeta": {
  "@nest-util/nest-auth": {
    "optional": true
  }
}
```

### Step 4.8: Update Demo-API Post Entity

**File:** `apps/demo-api/src/app/post/post.entity.ts`

Add:
```typescript
@Index()
@Column({ nullable: true })
authorId?: number;
```

### Step 4.9: Update Demo-API Post Service

**File:** `apps/demo-api/src/app/post/post.service.ts`

Add `userOwnershipField: 'authorId'` to service options.

### Step 4.10: Update Demo-API Post Controller

**File:** `apps/demo-api/src/app/post/post.controller.ts`

Add `enableFindMine: true` to controller factory options.

### Step 4.11: Create Migration

**Create new file:** `apps/demo-api/src/db/migrations/[timestamp]-AddAuthorIdToPost.ts`

```typescript
export class AddAuthorIdToPost implements MigrationInterface {
  name = 'AddAuthorIdToPost';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD COLUMN "authorId" integer`);
    await queryRunner.query(`CREATE INDEX "IDX_post_authorId" ON "post" ("authorId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_authorId"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "authorId"`);
  }
}
```

### Checkpoint 4: Validation

```bash
npx nx run-many -t typecheck
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
```

**Functional tests:**
- GET /post/mine returns posts where authorId matches current user
- GET /post/mine?page=1&limit=10 returns paginated results
- GET /post/mine with filters works
- Unauthenticated GET /post/mine returns 401
- Existing CRUD operations still work

### Commit Point 4

```bash
git add -A
git commit -m "feat(crud): add findMine endpoint for user-scoped queries

- Add findMine() method to NestCrudService with configurable ownership field
- Add GET /mine endpoint to controller factory (enableFindMine option)
- Support custom query functions for complex ownership (e.g., author OR collaborator)
- Auth guards inherited from consumer controller class
- Add demo with authorId on Post entity"
```

---

## Final Validation

### Full Test Suite

```bash
npx nx run-many -t typecheck
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
```

### Demo API Smoke Test

```bash
npx nx serve demo-api
```

Verify:
- POST /auth/register creates a user
- POST /auth/login returns tokens
- POST /post creates a post
- GET /post lists posts with pagination
- GET /post/:id retrieves a post
- PATCH /post/:id updates a post
- DELETE /post/:id deletes a post
- GET /post/auditlogs returns audit logs
- GET /post/mine returns user's posts (with authorId set)
- Filter queries work: `GET /post?filter[title_cont]=hello`
- Sorting works: `GET /post?orderBy=title&orderDirection=ASC`

### Swagger Documentation

Verify Swagger UI renders all endpoints correctly at `/api`.

---

## Risk Mitigation

### TypeORM Upgrade Risks

| Risk | Mitigation |
|------|------------|
| Removed APIs used | Verified: codebase uses none of the removed v1.0 APIs |
| Decorator changes | Verified: all standard decorators remain compatible |
| QueryBuilder changes | Verified: all QueryBuilder methods used remain unchanged |

### Audit Merge Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing imports | Re-export shim ensures backward compatibility |
| Circular dependencies | Audit package depends on CRUD (one-way), no cycle |
| Module registration | Demo-API updated to import from CRUD directly |

### Hooks Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing service API | All hook fields are optional, defaults to empty |
| Transaction failures | QueryRunner released in finally block |
| Performance overhead | Hooks are optional, < 5ms when not configured |

### FindMine Risks

| Risk | Mitigation |
|------|------------|
| Route conflicts | FindMine endpoint placed before /:id |
| Auth dependency | nest-auth is optional peerDep, types only |
| Complex ownership | Custom query function support for OR conditions |

---

## Post-Execution Cleanup

### Update Documentation

- Update README.md with new TypeORM version requirement
- Add migration guide for audit package consumers
- Document hook usage examples
- Document findMine configuration

### Version Bumps

Consider version bumps for:
- `@nest-util/nest-crud`: 0.1.1 → 0.2.0 (new features)
- `@nest-util/nest-audit`: 0.1.1 → 0.2.0 (breaking change: now re-export shim)
- `@nest-util/nest-auth`: 0.1.1 → 0.1.2 (peer dep update only)

### Deprecation Notices

Add `@deprecated` JSDoc to:
- `@nest-util/nest-audit` package (recommend using `@nest-util/nest-crud` directly)
