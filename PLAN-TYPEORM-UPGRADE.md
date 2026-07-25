# PLAN: TypeORM Upgrade 0.3.28 → 1.1.0

## Overview

Upgrade TypeORM from 0.3.28 to 1.1.0 across the entire nest-util monorepo while maintaining full backward compatibility for all consuming applications.

## Current State

| Package | Current Version | Target Version |
|---------|-----------------|----------------|
| `typeorm` | `^0.3.28` (resolves to `0.3.28`) | `^1.1.0` |
| `@nestjs/typeorm` | `^11.0.0` (resolves to `11.0.1`) | `^11.0.0` (no change) |

## Files Requiring Changes

### Critical Files (Must Change)

| File | Change Type | Reason |
|------|-------------|--------|
| `package.json:65` | Version bump | Root dependency |
| `libs/nest-crud/package.json:31` | Peer dependency | Consumer expectation |
| `libs/nest-auth/package.json:34` | Peer dependency | Consumer expectation |
| `libs/nest-audit/package.json:31` | Peer dependency | Consumer expectation |
| `apps/demo-api/src/db/ormconfig.ts:1` | API change | `DataSource` import path |

### Files Requiring Verification (May Not Change)

| File | Verification Needed |
|------|---------------------|
| `libs/nest-crud/src/lib/helpers/filter.helper.ts:1` | `SelectQueryBuilder` import |
| `libs/nest-crud/src/lib/helpers/pagination.helper.ts:1` | `SelectQueryBuilder` import |
| `libs/nest-crud/src/lib/helpers/exception-filter.helper.ts:7` | `QueryFailedError` import |
| `libs/nest-crud/src/lib/services/nest-crud.service.ts:2` | `Repository`, `DeepPartial`, `ObjectLiteral` imports |
| `libs/nest-auth/src/lib/services/auth.service.ts:11` | `DataSource` import |
| `libs/nest-auth/src/lib/services/auth.service.ts:12` | `Repository` import |
| All entity files | Decorator compatibility |

---

## Implementation Steps

### Step 1: Update Root Dependencies

**File:** `package.json`

```diff
- "typeorm": "^0.3.28"
+ "typeorm": "^1.1.0"
```

**Guardrail:** Run `pnpm install` and verify no peer dependency conflicts.

### Step 2: Update Library Peer Dependencies

**File:** `libs/nest-crud/package.json`

```diff
- "typeorm": "^0.3.28"
+ "typeorm": "^1.1.0"
```

**File:** `libs/nest-auth/package.json`

```diff
- "typeorm": "^0.3.28"
+ "typeorm": "^1.1.0"
```

**File:** `libs/nest-audit/package.json`

```diff
- "typeorm": "^0.3.28"
+ "typeorm": "^1.1.0"
```

**Guardrail:** All three libraries must agree on the same TypeORM version range.

### Step 3: Run TypeORM Codemod

```bash
npx typeorm-codemod
```

**What this automates:**
- Renames `connection` property to `dataSource` in metadata classes
- Detects removed APIs and suggests replacements
- Updates import paths where needed

**Guardrail:** Review all changes made by codemod before committing.

### Step 4: Fix ormconfig.ts

**File:** `apps/demo-api/src/db/ormconfig.ts`

**Current code (lines 1-20):**
```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../app/user/user.entity';
import { Role } from '../app/user/role.entity';
import { UserRole } from '../app/user/user-role.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'demo_user',
  password: process.env.DB_PASSWORD || 'demo_pass',
  database: process.env.DB_NAME || 'demo_db',
  entities: [User, Role, UserRole],
  migrations: ['src/db/migrations/*.ts'],
  synchronize: false,
  entitySkipConstructor: true,
});
```

**Required changes:**
1. Verify `DataSource` import still works (it should - `DataSource` is the v1 API)
2. Remove `entitySkipConstructor: true` if deprecated (check TypeORM 1.0 release notes)
3. Verify migration path glob pattern still works

**Updated code:**
```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../app/user/user.entity';
import { Role } from '../app/user/role.entity';
import { UserRole } from '../app/user/user-role.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'demo_user',
  password: process.env.DB_PASSWORD || 'demo_pass',
  database: process.env.DB_NAME || 'demo_db',
  entities: [User, Role, UserRole],
  migrations: ['src/db/migrations/*.ts'],
  synchronize: false,
});
```

**Guardrail:** Test migration generation and execution after this change.

### Step 5: Verify Entity Decorators

**Files to verify:**

| Entity | File | Decorators Used |
|--------|------|-----------------|
| `RoleEntity` | `libs/nest-auth/src/lib/entities/role.entity.ts` | `@Entity`, `@PrimaryGeneratedColumn`, `@Column`, `@Index`, `@CreateDateColumn`, `@UpdateDateColumn` |
| `UserRoleEntity` | `libs/nest-auth/src/lib/entities/user-role.entity.ts` | `@Entity`, `@PrimaryGeneratedColumn`, `@Column`, `@Index`, `@ManyToOne`, `@JoinColumn`, `@CreateDateColumn` |
| `AuditLogEntity` | `libs/nest-audit/src/lib/entities/audit-log.entity.ts` | `@Entity`, `@PrimaryGeneratedColumn`, `@Column`, `@Index`, `@CreateDateColumn` |
| `User` | `apps/demo-api/src/app/user/user.entity.ts` | `@Entity`, `@PrimaryGeneratedColumn`, `@Column`, `@CreateDateColumn`, `@UpdateDateColumn`, `@OneToMany` |
| `Post` | `apps/demo-api/src/app/post/post.entity.ts` | `@Entity`, `@PrimaryGeneratedColumn`, `@Column` |
| `Comment` | `apps/demo-api/src/app/comment/comment.entity.ts` | `@Entity`, `@PrimaryGeneratedColumn`, `@Column` |

**TypeORM 1.0 decorator changes:**
- All standard decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@Index`, `@CreateDateColumn`, `@UpdateDateColumn`, `@ManyToOne`, `@OneToMany`, `@JoinColumn`) remain compatible
- `@RelationCount` decorator was removed (not used in this codebase)
- `simple-array` column type remains supported

**Guardrail:** Run `npx nx run-many -t typecheck` to verify all entity types compile.

### Step 6: Verify Repository Usage Patterns

**Patterns used in codebase:**

| Pattern | Location | Status |
|---------|----------|--------|
| `@InjectRepository()` | `libs/nest-crud`, `libs/nest-audit` | Compatible |
| `DataSource.getRepository()` | `libs/nest-auth/src/lib/services/auth.service.ts:59-63` | Compatible |
| `repo.create()` | Multiple services | Compatible |
| `repo.save()` | Multiple services | Compatible |
| `repo.findOne()` / `repo.findOneBy()` | Multiple services | Compatible |
| `repo.find()` | Multiple services | Compatible |
| `repo.delete()` | Multiple services | Compatible |
| `repo.merge()` | `libs/nest-crud/src/lib/services/nest-crud.service.ts:175` | Compatible |
| `repo.createQueryBuilder()` | Multiple services | Compatible |
| `repo.manager.getRepository()` | `libs/nest-crud/src/lib/services/nest-crud.service.ts:201` | Compatible |
| `repo.metadata.name` | `libs/nest-crud/src/lib/services/nest-crud.service.ts:205` | Compatible |

**TypeORM 1.0 removed APIs (NOT used in this codebase):**
- `findByIds()` - Not used
- `findOneById()` - Not used
- `AbstractRepository` - Not used
- `getCustomRepository()` - Not used

**Guardrail:** Search codebase for removed APIs before proceeding:
```bash
grep -r "findByIds\|findOneById\|AbstractRepository\|getCustomRepository" --include="*.ts" libs/ apps/
```

### Step 7: Verify QueryBuilder Usage

**File:** `libs/nest-crud/src/lib/helpers/filter.helper.ts`

**TypeORM 1.0 QueryBuilder changes:**
- `createQueryBuilder()` signature unchanged
- `leftJoinAndSelect()` unchanged
- `andWhere()` unchanged
- `addSelect()` unchanged
- `orderBy()` unchanged
- `skip()` / `take()` unchanged
- `getManyAndCount()` unchanged
- `getOne()` unchanged
- Parameterized queries (`:param` syntax) unchanged

**Removed QueryBuilder methods (NOT used):**
- `printSql()` - Not used
- `replacePropertyNames()` - Not used
- `setNativeParameters()` - Not used
- `onConflict()` - Not used

**Guardrail:** Run `npx nx test nest-crud` to verify filter and pagination helpers work.

### Step 8: Verify Exception Filter

**File:** `libs/nest-crud/src/lib/helpers/exception-filter.helper.ts`

**Current code (line 7):**
```typescript
import { QueryFailedError } from 'typeorm';
```

**TypeORM 1.0 status:** `QueryFailedError` remains available and unchanged.

**Guardrail:** Test with a duplicate key violation to verify exception filter still catches `23505` error code.

### Step 9: Verify Auth Service DataSource Usage

**File:** `libs/nest-auth/src/lib/services/auth.service.ts`

**Current code (lines 11-12):**
```typescript
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
```

**TypeORM 1.0 status:** `DataSource` is the primary API (replaced deprecated `Connection`). This import is already correct.

**Current usage (lines 57-63):**
```typescript
constructor(
  @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
  private readonly jwtService: JwtService,
  @Inject(DataSource) private readonly dataSource: DataSource
) {
  this.userRepository = this.dataSource.getRepository(
    this.options.userEntity
  ) as Repository<Record<string, unknown>>;
  this.roleRepository = this.dataSource.getRepository(RoleEntity);
  this.userRoleRepository = this.dataSource.getRepository(UserRoleEntity);
}
```

**TypeORM 1.0 status:** `DataSource.getRepository()` is the recommended API. No changes needed.

**Guardrail:** Test auth flows (register, login, refresh) after upgrade.

### Step 10: Update Migration Files

**Files:** `apps/demo-api/src/db/migrations/*.ts`

**TypeORM 1.0 migration changes:**
- `MigrationInterface` remains available
- `QueryRunner` remains available
- `queryRunner.query()` remains available
- `queryRunner.getTable()` remains available

**No changes expected** for existing migration files.

**Guardrail:** Run `pnpm run migration:run` to verify migrations execute correctly.

---

## Acceptance Criteria

### Must Pass

- [ ] `pnpm install` completes without peer dependency conflicts
- [ ] `npx nx run-many -t typecheck` passes with no errors
- [ ] `npx nx run-many -t lint` passes with no errors
- [ ] `npx nx run-many -t test` passes with all tests green
- [ ] `npx nx run-many -t build` produces valid dist output
- [ ] `npx nx serve demo-api` starts without errors
- [ ] POST /post creates a post (CRUD create works)
- [ ] GET /post lists posts with pagination (CRUD findAll works)
- [ ] GET /post/:id retrieves a post (CRUD findOne works)
- [ ] PATCH /post/:id updates a post (CRUD update works)
- [ ] DELETE /post/:id deletes a post (CRUD remove works)
- [ ] GET /post/auditlogs lists audit logs (audit query works)
- [ ] POST /auth/register creates a user (auth register works)
- [ ] POST /auth/login returns tokens (auth login works)
- [ ] POST /auth/refresh rotates tokens (auth refresh works)
- [ ] Filter queries work: `GET /post?filter[title_cont]=hello`
- [ ] Pagination works: `GET /post?page=1&limit=10`
- [ ] Sorting works: `GET /post?orderBy=title&orderDirection=ASC`

### Should Pass

- [ ] TypeORM codemod runs without errors
- [ ] Existing migrations can be reverted and re-run
- [ ] `synchronize: true` works in development mode
- [ ] Swagger documentation renders correctly
- [ ] No TypeScript `any` type regressions

### Nice to Have

- [ ] Bundle size does not increase by more than 10%
- [ ] No new `@ts-ignore` or `@ts-expect-error` comments needed
- [ ] All JSDoc comments remain accurate

---

## Rollback Plan

If critical issues arise:

1. Revert `package.json` changes
2. Revert library `package.json` changes
3. Run `pnpm install`
4. Run full test suite to verify rollback

```bash
git checkout -- package.json libs/*/package.json
pnpm install
npx nx run-many -t test
```

---

## Best Practices

### Query Performance

1. **Index verification:** After upgrade, verify all `@Index()` decorators are still creating indexes correctly
2. **Query plans:** Use `EXPLAIN` on critical queries to verify query plans haven't changed
3. **N+1 prevention:** Verify `relations` loading in `findOne()` still works as expected

### Readability

1. **Import organization:** Group TypeORM imports together
2. **Type annotations:** Use explicit types for repository parameters
3. **Error messages:** Verify exception filter still provides clear error messages

### Maintainability

1. **Version pinning:** Use `^1.1.0` to allow patch updates
2. **Lock file:** Commit `pnpm-lock.yaml` after upgrade
3. **Documentation:** Update README.md with new TypeORM version requirement
