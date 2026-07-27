# Migration Guide: @nest-util v0.1.x → v1.0.x

This guide is for **consumer projects** that use `@nest-util/nest-crud`, `@nest-util/nest-auth`, and/or `@nest-util/nest-audit` as dependencies. It covers everything you need to do in YOUR project to upgrade.

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [What Changed](#what-changed)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Phase 1: Upgrade Dependencies](#phase-1-upgrade-dependencies)
- [Phase 2: Remove @nest-util/nest-audit](#phase-2-remove-nest-utilnest-audit)
- [Phase 3: Adopt Lifecycle Hooks (Optional)](#phase-3-adopt-lifecycle-hooks)
- [Phase 4: Enable findMine (Optional)](#phase-4-enable-findmine)
- [Phase 5: Cursor Pagination (No Changes Needed)](#phase-5-cursor-pagination)
- [Post-Migration Verification](#post-migration-verification)
- [Troubleshooting](#troubleshooting)
- [Agent Guardrails](#agent-guardrails)

---

## Quick Reference

If you just want the commands:

```bash
# 1. Upgrade dependencies
pnpm add @nest-util/nest-crud@^1.0.6 @nest-util/nest-auth@^1.0.2 typeorm@^1.1.0
pnpm add @nestjs/common@^11.0.0 @nestjs/core@^11.0.0 @nestjs/swagger@^11.2.6 @nestjs/typeorm@^11.0.1
pnpm add express@^5.2.1

# 2. Remove nest-audit
pnpm remove @nest-util/nest-audit

# 3. Find and replace all imports (see Phase 2)
# Search your codebase for: @nest-util/nest-audit
# Replace with: @nest-util/nest-crud

# 4. Remove NestUtilNestAuditModule from your app module imports

# 5. Run your tests
npm run test  # or your test command
npm run build  # or your build command
```

---

## What Changed

### Breaking Changes

| Change | Impact | Action Required |
|---|---|---|
| `@nest-util/nest-audit` deleted | All audit imports break | Replace all imports with `@nest-util/nest-crud` |
| `NestUtilNestAuditModule` removed | Module imports break | Remove from your `@Module({ imports: [...] })` |
| TypeORM 0.3.x → 1.1.0 | Entity/repository API changes | Run `npx @typeorm/codemod v1`, fix `entitySkipConstructor` |
| NestJS 10 → 11 | Peer dependency conflict | Upgrade `@nestjs/common`, `@nestjs/core`, etc. |
| Express 4 → 5 | Peer dependency conflict | Upgrade `express` to `^5.2.1` |

### New Features (Backward Compatible)

| Feature | Description | How to Enable |
|---|---|---|
| Lifecycle Hooks | `beforeCreate`, `afterCreate`, `beforeUpdate`, etc. | Add `hooks` to service options |
| findMine | `GET /mine` returns user's records | Add `userOwnershipField` + `enableFindMine: true` |
| Cursor Pagination | `?cursor=<opaque>` on `GET /` | No changes needed — automatic |

### Package Versions

| Package | Old Version | New Version |
|---|---|---|
| `@nest-util/nest-crud` | 0.1.1 | 1.0.6 |
| `@nest-util/nest-auth` | 0.0.3 | 1.0.2 |
| `@nest-util/nest-audit` | 0.1.1 | **Deleted** |
| `typeorm` | ^0.3.28 | ^1.1.0 |
| `@nestjs/common` | ^10.x | ^11.0.0 |
| `express` | ^4.x | ^5.2.1 |

---

## Pre-Migration Checklist

Before starting, ensure you have:

- [ ] A clean working tree (commit or stash current changes)
- [ ] All tests passing on your current version
- [ ] Node.js >= 18.x installed
- [ ] Access to your database (for migration testing)

```bash
# Create a migration branch
git checkout -b upgrade/nest-util-v1

# Verify current state
npm test  # or your test command
npm run build  # or your build command
```

---

## Phase 1: Upgrade Dependencies

**Risk Level:** Medium
**Estimated Time:** 10-15 minutes

### Step 1.1: Update Package Versions

**File:** `package.json`

Update these dependencies to the specified versions:

```json
{
  "dependencies": {
    "@nest-util/nest-crud": "^1.0.6",
    "@nest-util/nest-auth": "^1.0.2",
    "typeorm": "^1.1.0",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/swagger": "^11.2.6",
    "@nestjs/typeorm": "^11.0.1",
    "express": "^5.2.1"
  }
}
```

### Step 1.2: Remove nest-audit

```bash
pnpm remove @nest-util/nest-audit
```

### Step 1.3: Install Dependencies

```bash
pnpm install
```

**Guardrail:** Check for peer dependency conflicts. Resolve any conflicts before proceeding.

### Step 1.4: Run TypeORM Codemod

```bash
npx @typeorm/codemod v1
```

**What this automates:**
- Renames `connection` → `dataSource` in metadata classes
- Detects removed APIs and suggests replacements
- Updates import paths where needed

**Guardrail:** Review ALL changes made by the codemod before committing.

### Step 1.5: Remove entitySkipConstructor

**File:** Your DataSource configuration (e.g., `ormconfig.ts`, `data-source.ts`, or `TypeOrmModule.forRoot()`)

```diff
  TypeOrmModule.forRoot({
    type: 'postgres',
    // ... other options
    synchronize: false,
-   entitySkipConstructor: true,
  })
```

Or if using `DataSource` directly:

```diff
  export const AppDataSource = new DataSource({
    type: 'postgres',
    // ... other options
-   entitySkipConstructor: true,
  });
```

### Checkpoint 1: Dependencies

```bash
npm run build  # or your build command
npm test  # or your test command
```

**Must pass before proceeding.**

---

## Phase 2: Remove @nest-util/nest-audit

**Risk Level:** Medium
**Estimated Time:** 15-30 minutes

### What Happened

`@nest-util/nest-audit` has been **deleted entirely**. All audit functionality is now part of `@nest-util/nest-crud`.

### Step 2.1: Find All nest-audit Imports

```bash
grep -r "@nest-util/nest-audit" --include="*.ts" .
```

This will show every file that needs updating.

### Step 2.2: Replace All Imports

Replace every `@nest-util/nest-audit` import with `@nest-util/nest-crud`:

| Old Import | New Import |
|---|---|
| `import { Audit } from '@nest-util/nest-audit'` | `import { Audit } from '@nest-util/nest-crud'` |
| `import { AuditLogEntity } from '@nest-util/nest-audit'` | `import { AuditLogEntity } from '@nest-util/nest-crud'` |
| `import { AuditInterceptor } from '@nest-util/nest-audit'` | `import { AuditInterceptor } from '@nest-util/nest-crud'` |
| `import { AuditService } from '@nest-util/nest-audit'` | `import { AuditService } from '@nest-util/nest-crud'` |
| `import { ListAuditLogsDto } from '@nest-util/nest-audit'` | `import { ListAuditLogsDto } from '@nest-util/nest-crud'` |
| `import { CreateAuditLogInput } from '@nest-util/nest-audit'` | `import { CreateAuditLogInput } from '@nest-util/nest-crud'` |

**Quick find-and-replace:**
```bash
find . -name "*.ts" -exec sed -i "s/from '@nest-util\/nest-audit'/from '@nest-util\/nest-crud'/g" {} +
```

Or use your IDE's project-wide find-and-replace.

### Step 2.3: Remove NestUtilNestAuditModule from Your App Module

**File:** Your app module (e.g., `app.module.ts`)

```diff
  import { NestCrudModule } from '@nest-util/nest-crud';
- import { NestUtilNestAuditModule } from '@nest-util/nest-audit';
- import { AuditInterceptor } from '@nest-util/nest-audit';
+ import { AuditInterceptor } from '@nest-util/nest-crud';

  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        autoLoadEntities: true,  // ← REQUIRED — see Step 2.4
        // ...
      }),
      NestCrudModule,
-     NestUtilNestAuditModule,  // ← REMOVE THIS LINE
      AuthModule.forRoot({ /* ... */ }),
    ],
    providers: [
      { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    ],
  })
  export class AppModule {}
```

### Step 2.4: Ensure autoLoadEntities: true

**Critical:** `NestCrudModule` internally registers `AuditLogEntity` with TypeORM. You MUST have `autoLoadEntities: true` on your `TypeOrmModule.forRoot()`:

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  autoLoadEntities: true,  // ← REQUIRED
  // ...
})
```

Without this, you'll get "AuditLogEntity is not registered" errors.

### Checkpoint 2: Audit Merge

```bash
npm run build  # or your build command
npm test  # or your test command
```

**Functional Tests:**
- Audit logging still works (create/update/delete operations produce audit logs)
- `GET /auditlogs` endpoint returns data
- No import errors from `@nest-util/nest-audit`

---

## Phase 3: Adopt Lifecycle Hooks

**Risk Level:** Low
**Estimated Time:** 15-30 minutes
**Rollback:** Hooks are opt-in — skip this phase if you don't need them

### What's New

Lifecycle hooks let you run custom logic before or after CRUD operations, with optional transaction support.

### Available Hooks

| Hook | When It Runs | Context |
|---|---|---|
| `beforeCreate` | Before `repo.save()` | `{ payload }` |
| `afterCreate` | After `repo.save()` | `{ entity, payload }` |
| `beforeUpdate` | Before `repo.merge()` + `repo.save()` | `{ payload, entity, id }` |
| `afterUpdate` | After `findOne()` re-fetch | `{ entity, payload, id }` |
| `beforeRemove` | Before `repo.delete()` | `{ entity, id }` |
| `afterRemove` | After `repo.delete()` | `{ id, deleted }` |
| `beforeFindOne` | Before `repo.findOne()` | `{ id }` |
| `afterFindOne` | After `repo.findOne()` | `{ entity, id }` |

### Step 3.1: Add Hooks to Your Service

**File:** Your service file (e.g., `post.service.ts`)

```typescript
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      hooks: {
        beforeCreate: {
          handler: async (ctx) => {
            // Validate or transform payload before save
            ctx.payload.title = ctx.payload.title.trim();
          },
        },
        afterCreate: {
          handler: async (ctx) => {
            // Send notification, emit event, etc.
            await this.notificationService.notify('post.created', ctx.entity);
          },
        },
        beforeRemove: {
          handler: async (ctx) => {
            // Check if deletion is allowed
            if (ctx.entity.published) {
              throw new BadRequestException('Cannot delete published post');
            }
          },
          transaction: true,  // runs inside a DB transaction
        },
      },
      transactionConfig: {
        isolationLevel: 'READ COMMITTED',
      },
    });
  }
}
```

### Important: Hook Format

Hooks MUST be `CrudHookConfig` objects with a `handler` property:

```typescript
// ✅ Correct
hooks: {
  beforeCreate: {
    handler: async (ctx) => { /* ... */ },
  },
}

// ❌ Incorrect — missing handler wrapper
hooks: {
  beforeCreate: async (ctx) => { /* ... */ },
}
```

### Checkpoint 3: Hooks

```bash
npm run build  # or your build command
npm test  # or your test command
```

**Verify:** If you added hooks, confirm they fire correctly. If you didn't add hooks, confirm existing CRUD operations still work.

---

## Phase 4: Enable findMine

**Risk Level:** Medium
**Estimated Time:** 15-30 minutes
**Rollback:** Remove `enableFindMine` and `userOwnershipField`/`findMineQuery` from your config

### What's New

A new `GET /<resource>/mine` endpoint returns only records belonging to the logged-in user.

### Step 4.1: Add Ownership Field to Entity

**File:** Your entity file (e.g., `post.entity.ts`)

```diff
+ import { Index } from 'typeorm';

  @Entity()
  export class Post {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ nullable: true })
    title?: string;

+   @Index()
+   @Column({ nullable: true })
+   authorId?: number;
  }
```

### Step 4.2: Configure Service for findMine

**Option A: Simple column match** (e.g., `authorId = userId`)

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      userOwnershipField: 'authorId',  // WHERE e.authorId = :userId
    });
  }
}
```

**Option B: Custom query** (e.g., author OR collaborator)

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      findMineQuery: (qb, userId) => {
        qb.where('e.authorId = :userId', { userId })
          .orWhere(
            'e.id IN (SELECT postId FROM post_collaborators WHERE userId = :userId)',
            { userId }
          );
      },
    });
  }
}
```

### Step 4.3: Enable findMine in Controller

**File:** Your controller file (e.g., `post.controller.ts`)

```diff
  const PostCrudControllerBase = CreateNestedCrudController(
    CreatePostDto, UpdatePostDto, Post,
    {
      permissions: buildCrudPermissionsFromRegistry(permissionRegistry, { resource: 'posts' }),
+     enableFindMine: true,
    }
  ) as abstract new (service: PostService) => IBaseController<CreatePostDto, UpdatePostDto, Post>;
```

### Step 4.4: Create Database Migration

Create a migration to add the ownership column:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthorIdToPost1234567890 implements MigrationInterface {
  name = 'AddAuthorIdToPost1234567890';

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

Run the migration:

```bash
# If using TypeORM CLI
npx typeorm migration:run -d data-source.ts

# Or if your project has a migration script
npm run migration:run
```

### Step 4.5: Disable findMine (If Not Wanted)

If you don't want the `GET /mine` endpoint:

```typescript
super({
  repository,
  disabledEndpoints: ['findMine'],  // ← suppresses GET /mine
});
```

Or simply don't configure `userOwnershipField` or `findMineQuery` — the endpoint returns 404 by default.

### Checkpoint 4: findMine

```bash
npm run build  # or your build command
npm test  # or your test command
```

**Functional Tests:**
- `GET /post/mine` returns posts where `authorId` matches current user
- `GET /post/mine?page=1&limit=10` returns paginated results
- Unauthenticated `GET /post/mine` returns 401
- Existing CRUD operations still work

---

## Phase 5: Cursor Pagination

**Risk Level:** Low
**Estimated Time:** 0 minutes (already working)
**Rollback:** N/A — opt-in via query parameter

### What's New

All `GET /` endpoints now accept `?cursor=<opaque>` for cursor-based pagination. **No code changes needed** — the controller automatically dispatches to cursor pagination when `?cursor` is present.

### Usage

```bash
# First page (offset-based, backward compatible)
GET /posts?limit=10

# Next page (cursor-based)
GET /posts?cursor=eyJpZCI6MTB9&limit=10

# With total count
GET /posts?cursor=eyJpZCI6MTB9&limit=10&includeTotal=true
```

### Response Shape

```json
{
  "data": [...],
  "meta": {
    "limit": 10,
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTB9",
    "total": 42
  }
}
```

### Custom Cursor Strategy

Auto-detected from repository metadata. Override if needed:

```typescript
super({
  repository,
  cursorStrategy: {
    type: 'uuid',  // or 'integer'
    timestampColumn: 'createdAt',
  },
});
```

---

## Post-Migration Verification

### Full Test Suite

Run your project's test and build commands:

```bash
npm run build  # or your build command
npm test  # or your test command
npm run lint  # if you have a lint command
```

### Endpoint Smoke Test

Start your API and verify these endpoints:

| Endpoint | Method | Expected |
|---|---|---|
| POST /auth/register | Create user | 201 |
| POST /auth/login | Login | 200 + tokens |
| POST /auth/refresh | Refresh token | 200 + new tokens |
| POST /post | Create post | 201 + audit log |
| GET /post | List posts | 200 + pagination |
| GET /post/:id | Get post | 200 |
| PATCH /post/:id | Update post | 200 + audit log |
| DELETE /post/:id | Delete post | 200 + audit log |
| GET /post/auditlogs | Audit logs | 200 |
| GET /post/mine | User's posts | 200 (if enabled) |
| GET /post?filter[title_cont]=hello | Filter | 200 |
| GET /post?orderBy=title&orderDirection=ASC | Sort | 200 |
| GET /post?cursor=xxx&limit=10 | Cursor pagination | 200 |

### Swagger Documentation

Verify Swagger UI renders all endpoints correctly (typically at `/api` or `/docs`).

---

## Troubleshooting

### "Cannot find module '@nest-util/nest-audit'"

You still have imports from the deleted package. Find and replace all occurrences:

```bash
grep -r "@nest-util/nest-audit" --include="*.ts" .
```

Replace every occurrence with `@nest-util/nest-crud`. See [Phase 2, Step 2.2](#step-22-replace-all-imports).

### "AuditLogEntity is not registered"

Ensure `autoLoadEntities: true` is set on your `TypeOrmModule.forRoot()`:

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  autoLoadEntities: true,  // ← This is required
  // ...
})
```

### "findMine not configured"

The `GET /mine` endpoint requires BOTH:
1. `userOwnershipField` or `findMineQuery` in your **service** options
2. `enableFindMine: true` in your **controller** factory

### TypeORM 1.x Errors

Run the codemod to auto-fix most issues:

```bash
npx @typeorm/codemod v1
```

Common manual fixes:
- Remove `entitySkipConstructor: true` from DataSource config
- `SelectQueryBuilder` is now imported from `typeorm` directly
- `Repository.findOne()` options may differ slightly

### Hooks Not Firing

Ensure hooks use the `CrudHookConfig` format with a `handler` property:

```typescript
// ✅ Correct
hooks: {
  beforeCreate: {
    handler: async (ctx) => { /* ... */ },
  },
}

// ❌ Incorrect
hooks: {
  beforeCreate: async (ctx) => { /* ... */ },
}
```

### Filter Queries Not Working

1. Set the Express query parser to `extended` in your `main.ts`:
   ```typescript
   app.getHttpAdapter().getInstance().set('query parser', 'extended');
   ```
2. Whitelist filterable fields via `allowedFilters` in your service options

### TS2742: Inferred Type Is Not Portable

Add `implements IBaseController<CD, UD, RD>` to controllers extending `CreateNestedCrudController(...)`:

```typescript
const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post
) as abstract new (service: PostService) => IBaseController<CreatePostDto, UpdatePostDto, Post>;

@ApiTags('post')
@Controller('post')
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

### Duplicate Key Errors (23505)

Register `TypeOrmExceptionFilter` as a global filter in your `main.ts`:

```typescript
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new TypeOrmExceptionFilter());
  // ...
}
```

---

## Agent Guardrails

### Pre-Migration

1. **ALWAYS** create a migration branch before starting
2. **ALWAYS** verify current tests pass before making changes
3. **ALWAYS** back up your database before running migrations
4. **NEVER** skip the TypeORM codemod — it handles most breaking changes

### During Migration

1. **ALWAYS** follow the phased approach — do not skip phases
2. **ALWAYS** run your test suite after each phase
3. **ALWAYS** commit after each successful phase
4. **NEVER** proceed to the next phase if the current phase fails
5. **NEVER** modify multiple phases simultaneously

### Import Changes

1. **ALWAYS** use `@nest-util/nest-crud` for audit-related imports
2. **ALWAYS** remove `NestUtilNestAuditModule` from your module imports
3. **ALWAYS** ensure `autoLoadEntities: true` on `TypeOrmModule.forRoot()`
4. **NEVER** import from `@nest-util/nest-audit` — the package is deleted

### Hooks

1. **ALWAYS** use `CrudHookConfig` format with `handler` property
2. **ALWAYS** set `transaction: true` for hooks that modify data
3. **ALWAYS** handle errors in hooks — they can roll back transactions
4. **NEVER** put heavy computation in synchronous hooks

### findMine

1. **ALWAYS** add `@Index()` to ownership fields for query performance
2. **ALWAYS** use parameterized queries in `findMineQuery` (never string concatenation)
3. **ALWAYS** set `enableFindMine: true` in controller factory to enable the endpoint
4. **NEVER** expose `findMine` without authentication guards

### Testing

1. **ALWAYS** run full test suite after each phase
2. **ALWAYS** verify CRUD operations work end-to-end
3. **ALWAYS** test with unauthenticated and authenticated requests
4. **ALWAYS** verify Swagger documentation renders correctly

### Rollback

```bash
# Undo last commit, keep changes
git reset --soft HEAD~1

# Discard all changes
git checkout -- .

# Full rollback to before migration
git reset --hard [commit-hash-before-migration]
npm install
```

---

## Summary

```bash
# Step 1: Upgrade dependencies
pnpm add @nest-util/nest-crud@^1.0.6 @nest-util/nest-auth@^1.0.2 typeorm@^1.1.0
pnpm add @nestjs/common@^11.0.0 @nestjs/core@^11.0.0 @nestjs/swagger@^11.2.6 @nestjs/typeorm@^11.0.1
pnpm add express@^5.2.1

# Step 2: Remove nest-audit
pnpm remove @nest-util/nest-audit

# Step 3: Replace all imports
grep -r "@nest-util/nest-audit" --include="*.ts" .
# Replace each occurrence with @nest-util/nest-crud

# Step 4: Remove NestUtilNestAuditModule from your app module

# Step 5: Run TypeORM codemod
npx @typeorm/codemod v1

# Step 6: Remove entitySkipConstructor from DataSource config

# Step 7: Set query parser to extended in main.ts
# app.getHttpAdapter().getInstance().set('query parser', 'extended');

# Step 8: Verify
npm run build
npm test
```
