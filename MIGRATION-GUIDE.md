# Migration Guide: @nest-util → latest (v1.x)

This guide is for **consumer projects** that use `@nest-util/nest-crud`, `@nest-util/nest-auth`, and/or the newer `@nest-util/nest-notify` as dependencies. It covers everything you need to do in **YOUR** project to upgrade to the latest `1.x` releases:

| Package | Latest Version |
|---|---|
| `@nest-util/nest-crud` | **1.2.2** |
| `@nest-util/nest-auth` | **1.4.5** |
| `@nest-util/nest-notify` | **1.1.1** |

The guide is structured in phases. Phases 1–6 are the original `0.1.x → 1.0.x` upgrade (still required). Phases 7–16 document every feature added **after** `nest-crud@1.0.7` / `nest-auth@1.1.0` and how to adopt it. All post-1.0 features are opt-in unless noted otherwise.

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [What Changed](#what-changed)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Phase 1: Upgrade Dependencies](#phase-1-upgrade-dependencies)
- [Phase 2: Remove @nest-util/nest-audit](#phase-2-remove-nest-utilnest-audit)
- [Phase 3: Adopt Lifecycle Hooks (Optional)](#phase-3-adopt-lifecycle-hooks-optional)
- [Phase 4: Enable findMine (Optional)](#phase-4-enable-findmine-optional)
- [Phase 5: Enable Ownership Enforcement (Optional)](#phase-5-enable-ownership-enforcement-optional)
- [Phase 6: Cursor Pagination (No Changes Needed)](#phase-6-cursor-pagination-no-changes-needed)
- [Phase 7: Status Pipeline (Optional)](#phase-7-status-pipeline-optional)
- [Phase 8: Approval Pipeline (Optional)](#phase-8-approval-pipeline-optional)
- [Phase 9: Audit Event Bus (Optional)](#phase-9-audit-event-bus-optional)
- [Phase 10: Auth Hardening — Rate Limit, Lockout, Reset Abuse (Optional)](#phase-10-auth-hardening--rate-limit-lockout-reset-abuse-optional)
- [Phase 11: Registration Verification (Optional)](#phase-11-registration-verification-optional)
- [Phase 12: Assisted Onboarding (Optional)](#phase-12-assisted-onboarding-optional)
- [Phase 13: Registration Hooks & Multi-Identifier Login (Optional)](#phase-13-registration-hooks--multi-identifier-login-optional)
- [Phase 14: User Management & Profile Endpoints (Optional)](#phase-14-user-management--profile-endpoints-optional)
- [Phase 15: API Key Authentication (Optional)](#phase-15-api-key-authentication-optional)
- [Phase 16: Notify — FCM Push, SMTP Email & WebSocket (Optional)](#phase-16-notify--fcm-push-smtp-email--websocket-optional)
- [Phase 17: Standardized Error System (`@nest-util/nest-error`)](#phase-17-standardized-error-system-nest-utilnest-error)
- [Post-Migration Verification](#post-migration-verification)
- [Troubleshooting](#troubleshooting)
- [Agent Guardrails](#agent-guardrails)

---

## Quick Reference

If you just want the commands:

```bash
# 1. Upgrade dependencies
pnpm add @nest-util/nest-crud@^1.2.2 @nest-util/nest-auth@^1.4.5 typeorm@^1.1.0
pnpm add @nestjs/common@^11.0.0 @nestjs/core@^11.0.0 @nestjs/swagger@^11.2.6 @nestjs/typeorm@^11.0.1
pnpm add express@^5.2.1

# Optional: add the notify package
pnpm add @nest-util/nest-notify@^1.1.1

# Required: standardized error system (peer dep of all nest-util libs)
pnpm add @nest-util/nest-error@^1.0.0

# Optional: auth hardening requires throttler
pnpm add @nestjs/throttler

# 2. Remove nest-audit (deleted in v1)
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
| `getCurrentUser` → `CurrentUser` | If you referenced the old decorator name | Use `@CurrentUser()` (already the case since `1.0.x`) |
| **New required peer `@nest-util/nest-error`** | App fails to boot without it (`Cannot find module`) | `pnpm add @nest-util/nest-error@^1.0.0` |
| **Error response body shape changed** | `message` becomes an object unless `LocalizationModule` is registered; with it, the `error` field is removed and `code`/`errorKey`/`timestamp`/`path` are added | Register `LocalizationModule.forRoot(...)` (see Phase 17); update clients to read `body.code` |
| **English error wording changed** | Messages now come from generic `errorKey` defaults (e.g. `Resource not found` → `The requested resource was not found`) | Assert on `body.code` instead of message text; override via `error-messages.json` |

### New Features (Backward Compatible / Opt-In)

| Feature | Since | Description | How to Enable |
|---|---|---|---|
| Lifecycle Hooks | 1.0.x | `beforeCreate`, `afterCreate`, `beforeUpdate`, etc. | Add `hooks` to service options |
| findMine | 1.0.x | `GET /mine` returns user's records | Add `userOwnershipField` + `enableFindMine: true` |
| Ownership Enforcement | 1.0.x | Scope `findOne`/`update`/`remove`/`create` to owned records | Add `enforceOwnership: true` |
| Cursor Pagination | 1.0.x | `?cursor=<opaque>` on `GET /` | No changes needed — automatic |
| `relations` option | 1.0.x | Resolve FK IDs → entities on create/update | Add `relations: [...]` to service options |
| **Status Pipeline** | **1.2.x** | `POST /:id/status` transition FSM with permissions + actions | Add `statusPipeline` to service options |
| **Approval Pipeline** | **1.2.x** | Pending/approve/reject/request-modification workflow | Add `approvalPipeline` to service options |
| **Audit Event Bus** | **1.2.x** | Pluggable `AuditEvent` handlers (besides `AuditLogEntity`) | Register `AuditEventModule` + handlers |
| **Auth Rate Limiting** | **1.4.x** | Per-IP throttling of sensitive auth routes | Add `rateLimit` + install `@nestjs/throttler` |
| **Login Lockout** | **1.4.x** | Per-account failed-login lockout (DB-backed) | Add `loginAttempts` |
| **Password-Reset Abuse Prevention** | **1.4.x** | Cooldown/lockout on reset requests | Configure `passwordReset` abuse fields |
| **Registration Verification (OTP)** | **1.1.x** | Verify email/phone after register | Add `verification: { enabled: true, deliverCode }` |
| **Assisted Onboarding** | **1.1.x** | Agent-created users via OTP + single-use token | Add `onboarding: { enabled: true, deliverCode }` |
| **Registration Hooks** | **1.4.x** | before/after register logic in a transaction | Add `registerHooks` |
| **Multi-Identifier Login** | **1.4.x** | Log in via email OR phone, etc. | Add `identifierFields: [...]` |
| **User Management Endpoints** | **1.4.x** | Admin list/get/create/update/activate users | Add `userManagement` |
| **Profile Self-Edit** | **1.4.x** | `PATCH /auth/me` for end users | Configure `userManagement.profilePermission` |
| **API Key Auth** | **1.4.x** | `x-api-key` header auth with roles | Add `apiKey: { enabled: true }` |
| **Notify (FCM + SMTP + WS)** | **1.1.x** | Push/email notifications + websocket gateway | Add `NestNotifyModule.forRoot(...)` |
| **Standardized Error System** | **next** | `@nest-util/nest-error`: stable `errorKey`, localized/generic error bodies, `LocalizedExceptionFilter` (handles `23505` → `DB_DUPLICATE_ENTRY`) | `pnpm add @nest-util/nest-error` + register `LocalizationModule.forRoot(...)` — see [Phase 17](#phase-17-standardized-error-system-nest-utilnest-error) and the [Nest Error Migration Guide](./NEST-ERROR-MIGRATION-GUIDE.md) |

### Package Versions

| Package | Old Version | New Version |
|---|---|---|
| `@nest-util/nest-crud` | 0.1.1 | **1.2.2** |
| `@nest-util/nest-auth` | 0.0.3 | **1.4.5** |
| `@nest-util/nest-notify` | — (new) | **1.1.1** |
| `@nest-util/nest-error` | — (new) | **1.0.0** |
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
- [ ] `@nestjs/throttler` available if you plan to enable auth rate limiting

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
    "@nest-util/nest-crud": "^1.2.2",
    "@nest-util/nest-auth": "^1.4.5",
    "typeorm": "^1.1.0",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/swagger": "^11.2.6",
    "@nestjs/typeorm": "^11.0.1",
    "express": "^5.2.1"
  }
}
```

If you want push/email/websocket notifications, also add:

```json
{
  "dependencies": {
    "@nest-util/nest-notify": "^1.1.1"
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

**Critical:** `NestCrudModule` internally registers `AuditLogEntity` **and** the new approval-pipeline entities (`ApprovalStatusEntity`, `ModificationRequestHistoryEntity`) with TypeORM. You MUST have `autoLoadEntities: true` on your `TypeOrmModule.forRoot()`:

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  autoLoadEntities: true,  // ← REQUIRED
  // ...
})
```

Without this, you'll get "Entity is not registered" errors (both for `AuditLogEntity` and the approval tables).

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

## Phase 5: Enable Ownership Enforcement

**Risk Level:** Low
**Estimated Time:** 5 minutes
**Rollback:** Remove `enforceOwnership: true` from your service config

### What's New

When `enforceOwnership: true` is set alongside `userOwnershipField` or `findMineQuery`, the generic `findOne`, `update`, and `remove` operations are scoped to records owned by the authenticated user. Non-owned records return 404 (no existence leak), and unauthenticated requests return 403 (fail-closed). `create` auto-overwrites the ownership field with the authenticated user's ID — users can only create records for themselves. Admins with bypass permissions get full access.

### Step 5.1: Add Enforcement to Service

```typescript
super({
  repository,
  userOwnershipField: 'authorId',                  // or findMineQuery
  enforceOwnership: true,                          // opt-in — defaults to false
  ownershipBypassPermissions: ['admin.access'],    // admins bypass checks
  // ownershipBypass: (user) => user.email?.endsWith('@example.com'),  // custom bypass
  // superAdminPermission: 'admin.access',          // mirrors rbac.superAdminPermission
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enforceOwnership` | `boolean` | `false` | Enable ownership checks on `findOne`/`update`/`remove` |
| `ownershipBypassPermissions` | `readonly string[]` | `[]` | Permission strings that grant full access |
| `ownershipBypass` | `(user: OwnershipUser) => boolean` | — | Custom predicate for bypassing ownership |
| `superAdminPermission` | `string` | — | Permission string (mirrors `rbac.superAdminPermission`) that skips ownership checks |

### Step 5.2: No Controller Changes Needed

The `@CurrentUser()` decorator is already wired into `findOne`, `update`, and `remove` in the controller factory. The `user` parameter is forwarded automatically — no controller changes are required.

### Checkpoint 5: Ownership Enforcement

```bash
npm run build  # or your build command
npm test  # or your test command
```

**Functional Tests:**
- `GET /post/1` with owner JWT → returns record
- `GET /post/2` with non-owner JWT → returns 404
- `GET /post/1` unauthenticated → returns 403
- `POST /post` with owner JWT → auto-sets `authorId` to current user
- `POST /post` with admin JWT → can set any `authorId`
- `POST /post` unauthenticated → returns 403
- `PATCH /post/1` + `DELETE /post/1` follow same ownership rules

---

## Phase 6: Cursor Pagination

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

### `relations` Option (also available)

If your create/update DTOs carry foreign-key IDs, configure `relations` to have them resolved to entities automatically:

```typescript
super({
  repository: postRepo,
  relations: [
    { property: 'author', repo: userRepo, idField: 'authorId' },
    { property: 'category', repo: categoryRepo },  // idField defaults to 'categoryId'
  ],
});
// Creating a Post with { title: '...', authorId: 5 }:
// 1. Fetches User with id=5 from userRepo
// 2. Sets post.author = fetchedUser
// 3. Deletes post.authorId from the payload before save
```

## Phase 7: Status Pipeline (Optional)

**Risk Level:** Medium (adds a new DB column + endpoint)
**Estimated Time:** 20-40 minutes
**Rollback:** Disable by removing `statusPipeline` from service options + `changeStatus` from `disabledEndpoints`

### What's New

`nest-crud@1.1.x+` ships a **status transition FSM**. When configured, your entity gets a status column, every create applies an `initial` status, and a new `POST /:id/status` endpoint enforces an allow-list of transitions. Transitions can require a permission and/or run an action callback after they are persisted.

### Step 7.1: Add a Status Column to Your Entity

```diff
+ @Column({ default: 'pending' })
+ status?: string;
```

### Step 7.2: Configure the Pipeline in Your Service

```typescript
super({
  repository,
  statusPipeline: {
    field: 'status',                 // entity column holding the status
    initial: 'pending',              // applied on create when payload omits status
    allowCreateStatuses: ['pending'],// statuses a create payload may set directly
    transitions: {
      // simple map form:
      pending: ['approved', 'rejected'],
      approved: ['pending'],         // controlled downgrade allowed
      rejected: ['pending'],
    },
    onTransition: async (ctx) => {
      // ctx = { id, entity, from, to, user? } — runs after every transition
      console.log(`status ${ctx.from} -> ${ctx.to} on ${ctx.id}`);
    },
  },
});
```

**Edge form** (per-transition permission + action):

```typescript
statusPipeline: {
  field: 'status',
  initial: 'pending',
  transitions: [
    { from: 'pending', to: ['approved', 'rejected'], permission: 'posts.approve' },
    {
      from: 'approved',
      to: ['pending'],
      action: async (ctx) => { /* notify author of reversal */ },
    },
  ],
}
```

### Step 7.3: The New Endpoint

| Endpoint | Method | Body | Permission (if `permission` set on edge) |
|---|---|---|---|
| `POST /:id/status` | `@Post(':id/status')` | `StatusChangeDto { status }` | The matched edge's `permission` |

```bash
curl -X POST /posts/10/status -H 'Content-Type: application/json' -d '{ "status": "approved" }'
```

A transition not listed in `transitions` is rejected with `400`. To hide the endpoint, add `'changeStatus'` to `disabledEndpoints`.

### Step 7.4: Migration

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE "post" ADD COLUMN "status" varchar NOT NULL DEFAULT 'pending'`);
}
public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "status"`);
}
```

### Checkpoint 7: Status Pipeline

- `POST /posts` with no `status` → row has `status: 'pending'`
- `POST /posts/10/status` with `{ "status": "approved" }` → persisted
- `POST /posts/10/status` with `{ "status": "bogus" }` → `400`

---

## Phase 8: Approval Pipeline (Optional)

**Risk Level:** Medium-High (adds two tables + five endpoints)
**Estimated Time:** 30-60 minutes
**Rollback:** Disable by removing `approvalPipeline` from service options

### What's New

`nest-crud@1.1.x+` ships an **approval workflow**. When enabled, every created record also gets a pending `approval_statuses` row (in the same transaction). New endpoints drive the lifecycle:

```
pending ──────────> approved
   │  └───────────> rejected
   └─> modification_requested ──> resubmitted ──> approved / rejected
```

### Step 8.1: Enable in Service Options

```typescript
super({
  repository,
  approvalPipeline: {
    enabled: true,                              // defaults to true when block present
    permissions: {
      approve: 'posts.approve',                 // pending/resubmitted -> approved
      reject: 'posts.reject',                   // pending/resubmitted -> rejected
      requestModification: 'posts.review',      // -> modification_requested
      resubmit: 'posts.submit',                 // modification_requested -> resubmitted
    },
    // visibleStatuses: ['approved'],            // read endpoints only show approved rows
  },
});
```

When `permissions` are set, each action requires the matching permission; when unset, any caller may perform it. `visibleStatuses` (e.g. `['approved']`) restricts `findAll`/`findOne`/`findMine`/`findAllWithCursor` to records in those states.

### Step 8.2: New Endpoints

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `GET /:id/approval` | `@Get(':id/approval')` | — | Returns `{ approval, history }` |
| `POST /:id/approval/approve` | `@Post(':id/approval/approve')` | — | `pending`/`resubmitted` → `approved` |
| `POST /:id/approval/reject` | `@Post(':id/approval/reject')` | — | `pending`/`resubmitted` → `rejected` |
| `POST /:id/approval/request-modification` | `@Post(':id/approval/request-modification')` | `RequestModificationDto` | → `modification_requested` |
| `POST /:id/approval/resubmit` | `@Post(':id/approval/resubmit')` | — | `modification_requested` → `resubmitted` |

`RequestModificationDto`:

```json
{
  "modifications": [
    { "field": "title", "wantedValue": "Corrected Title", "note": "typo" }
  ],
  "note": "please fix"
}
```

### Step 8.3: Database Tables (auto-registered via `autoLoadEntities`)

Two new entities must be migrated (they are registered by `NestCrudModule` automatically when `autoLoadEntities: true`):

- `approval_statuses` (`ApprovalStatusEntity`): `id`, `entity`, `entityId`, `status`, `requestedBy`, `requestedAt`, `currentModifications` (jsonb), `decidedBy`, `decidedAt`, `resubmittedBy`, `resubmittedAt`, `createdAt`, `updatedAt`
- `approval_modification_history` (`ModificationRequestHistoryEntity`): `id`, `approvalStatusId` (FK → `approval_statuses.id` cascade), `modifications` (jsonb), `requestedBy`, `note`, `requestedAt`

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE "approval_statuses" (
      "id" SERIAL PRIMARY KEY,
      "entity" varchar NOT NULL,
      "entityId" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "requestedBy" varchar,
      "requestedAt" timestamptz NOT NULL DEFAULT now(),
      "currentModifications" jsonb,
      "decidedBy" varchar,
      "decidedAt" timestamptz,
      "resubmittedBy" varchar,
      "resubmittedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
  await queryRunner.query(`CREATE INDEX "IDX_apst_entity" ON "approval_statuses" ("entity")`);
  await queryRunner.query(`CREATE INDEX "IDX_apst_entityId" ON "approval_statuses" ("entityId")`);
  await queryRunner.query(`CREATE INDEX "IDX_apst_status" ON "approval_statuses" ("status")`);

  await queryRunner.query(`
    CREATE TABLE "approval_modification_history" (
      "id" SERIAL PRIMARY KEY,
      "approvalStatusId" integer NOT NULL,
      "modifications" jsonb NOT NULL,
      "requestedBy" varchar,
      "note" varchar,
      "requestedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_apmh_status" FOREIGN KEY ("approvalStatusId")
        REFERENCES "approval_statuses"("id") ON DELETE CASCADE
    )`);
  await queryRunner.query(`CREATE INDEX "IDX_apmh_status" ON "approval_modification_history" ("approvalStatusId")`);
}
```

### Checkpoint 8: Approval Pipeline

- `POST /posts` → new `approval_statuses` row with `status: 'pending'`
- `POST /posts/10/approval/approve` → `approved`
- `POST /posts/10/approval/request-modification` → `modification_requested`, history appended
- `GET /posts/10/approval` → returns approval + history

---

## Phase 9: Audit Event Bus (Optional)

**Risk Level:** Low
**Estimated Time:** 10-20 minutes
**Rollback:** Stop registering `AuditEventModule` / remove handlers

### What's New

Beyond the `audit_logs` table, `nest-crud@1.2.x` emits in-process `AuditEvent`s (dot-named, e.g. `auth.user.login.success`, `post.create`). You can subscribe with custom handlers — useful for streaming to a log aggregator, metrics, or a message bus.

### Step 9.1: Register the Module

```typescript
import { AuditEventModule } from '@nest-util/nest-crud';

@Module({
  imports: [
    AuditEventModule.register({
      handlers: [new ConsoleAuditEventHandler()],
      include: ['*'],           // glob patterns to emit
      exclude: ['auth.user.*'], // glob patterns to suppress
    }),
  ],
})
export class AppModule {}
```

### Step 9.2: Implement a Handler

```typescript
import { AuditEventHandler, AuditEvent } from '@nest-util/nest-crud';

export class ConsoleAuditEventHandler implements AuditEventHandler {
  handle(event: AuditEvent): void {
    // event.action, event.entity, event.entityId, event.userId, event.ip, ...
    console.log('AUDIT', event.action, event.entity, event.entityId);
  }
}
```

A `ConsoleAuditEventHandler` is shipped in the package for quick local testing.

### Checkpoint 9: Audit Event Bus

- Perform a CRUD action → your handler's `handle()` is invoked
- Handlers run after the DB write (fire-and-forget, exceptions are isolated per handler)

---

## Phase 10: Auth Hardening — Rate Limit, Lockout, Reset Abuse (Optional)

**Risk Level:** Low (defensive; all opt-in)
**Estimated Time:** 15-30 minutes
**Rollback:** Remove the offending option block

All three features exist in `nest-auth@1.4.x`. None are on by default.

### Step 10.1: IP Rate Limiting (requires `@nestjs/throttler`)

```bash
pnpm add @nestjs/throttler
```

```typescript
AuthModule.forRoot({
  // ...
  rateLimit: {
    enabled: true,
    global: { ttlSeconds: 60, limit: 30 },
    login: { ttlSeconds: 60, limit: 10 },
    register: { ttlSeconds: 3600, limit: 5 },
    otpRequest: { ttlSeconds: 60, limit: 3 },
    otpLogin: { ttlSeconds: 60, limit: 5 },
    passwordResetRequest: { ttlSeconds: 60, limit: 3 },
    passwordResetReset: { ttlSeconds: 3600, limit: 10 },
    // keyGenerator: (req) => (req.ips[0] ?? req.ip),  // trust-proxy aware default
  },
});
```

Exceeding a limit returns `429`. If `@nestjs/throttler` is not installed, set `enabled: false` or omit the block.

### Step 10.2: Per-Account Login Lockout (DB-backed)

```typescript
AuthModule.forRoot({
  // ...
  loginAttempts: {
    enabled: true,
    maxAttempts: 5,       // default
    lockSeconds: 300,     // default
    attemptsField: 'loginAttempts',     // default — add to your User entity
    lockUntilField: 'loginLockedUntil', // default — add to your User entity
  },
});
```

Add the two columns to your User entity (and migrate):

```diff
+ @Column({ type: 'int', default: 0 })
+ loginAttempts?: number;
+ @Column({ type: 'timestamptz', nullable: true })
+ loginLockedUntil?: Date;
```

### Step 10.3: Password-Reset Abuse Prevention

```typescript
AuthModule.forRoot({
  // ...
  passwordReset: {
    enabled: true,
    cooldownSeconds: 60,                  // default — min gap between requests
    maxAttempts: 5,                       // default — attempts before lock
    lockSeconds: 300,                     // default
    attemptsField: 'passwordResetAttempts',       // add to User entity
    lockUntilField: 'passwordResetLockedUntil',   // add to User entity
    lastRequestAtField: 'passwordResetLastRequestedAt', // add to User entity
    deliverToken: async ({ identifier, token }) => { /* send */ },
  },
});
```

### Checkpoint 10: Auth Hardening

- 11th `POST /auth/login` from one IP within 60s → `429`
- 6th bad password for an account → `423`/lock until `loginLockedUntil`
- Second `POST /auth/password-reset/request` within cooldown → rejected

---

## Phase 11: Registration Verification (Optional)

**Risk Level:** Medium (adds user columns + two endpoints)
**Estimated Time:** 20-30 minutes

### What's New

`nest-auth@1.1.x` can send an OTP after registration and gate login on `verified`. Endpoints: `POST /auth/verify`, `POST /auth/verify/resend`.

### Step 11.1: Configure

```typescript
AuthModule.forRoot({
  // ...
  verification: {
    enabled: true,
    deliverCode: async ({ identifier, code }) => { /* send OTP */ },
    verifiedField: 'verified',       // default
    verifiedAtField: 'verifiedAt',   // default
    codeHashField: 'verifyCodeHash',
    expiresAtField: 'verifyCodeExpiresAt',
    identifierField: 'email',        // which registration field to deliver to
  },
});
```

Add to your User entity: `verified` (bool), `verifiedAt` (timestamptz), `verifyCodeHash`, `verifyCodeExpiresAt`.

### Step 11.2: Behavior

- After `POST /auth/register`, an OTP is delivered; `verified = false`
- `POST /auth/verify` with `{ code }` sets `verified = true`
- `POST /auth/verify/resend` re-sends the code (cooldown respected)
- `login` rejects unverified accounts until verified (when `verifiedField` is set)

---

## Phase 12: Assisted Onboarding (Optional)

**Risk Level:** Medium
**Estimated Time:** 20-30 minutes

### What's New

Agent-assisted onboarding: an agent starts an attempt (OTP to the invitee), verifies the code, and receives a single-purpose onboarding JWT that guards one user-creation endpoint. No password is set; created users log in with OTP.

### Step 12.1: Configure

```typescript
AuthModule.forRoot({
  // ...
  onboarding: {
    enabled: true,
    deliverCode: async ({ identifier, code }) => { /* send OTP to invitee */ },
    onboardingTokenSecret: '...',   // defaults to jwtSecret
    onboardingTokenExpiresIn: '15m',
  },
  permissionRegistry: {
    resources: [{ resource: 'onboarding', permissions: ['start', 'complete'] }],
  },
});
```

### Step 12.2: Flow & Endpoints

1. Agent: `POST /auth/onboarding/start` `{ email }` → OTP to invitee (rate-limited)
2. Agent: `POST /auth/onboarding/complete` `{ email, code }` → `{ onboarding_token }` (single-use, `15m`)
3. Agent: `POST /auth/onboarding/user` with `Authorization: Bearer <onboarding_token>` → user created via `registerHooks`, `verifiedAt` set, attempt consumed

Attempt state lives on a dedicated `OnboardingAttemptEntity` (not the User row); only one pending attempt per identifier. Permissions `onboarding.start` / `onboarding.complete` are enforced via `@Permissions` + `PermissionsGuard`.

---

## Phase 13: Registration Hooks & Multi-Identifier Login (Optional)

### Step 13.1: Registration Hooks

`nest-auth@1.4.x` lets you run logic atomically with user creation:

```typescript
AuthModule.forRoot({
  // ...
  registerHooks: {
    beforeRegister: async (ctx) => {
      // ctx.payload is mutable; flows into the saved user
    },
    afterRegister: async (ctx) => {
      // ctx.entity, ctx.userId available; ctx.manager is transaction-scoped
      await ctx.assignRole('member'); // role id (number) or name (string)
    },
  },
});
```

A throwing hook rolls back the whole registration.

### Step 13.2: Multi-Identifier Login

Log in with email **or** phone (or any set of fields):

```typescript
AuthModule.forRoot({
  // ...
  identifierFields: ['email', 'phone'], // takes precedence over identifierField
});
```

Lookups match any of these fields, so a user can present either value at `POST /auth/login`.

---

## Phase 14: User Management & Profile Endpoints (Optional)

**Risk Level:** Medium
**Estimated Time:** 20-30 minutes

### What's New

`nest-auth@1.4.x` exposes admin user-management endpoints and a self-service profile edit. Both are config-driven (your User entity is consumer-provided).

### Step 14.1: Configure

```typescript
AuthModule.forRoot({
  // ...
  userManagement: {
    enabled: true,                  // default true when block present
    permission: 'admin.access',     // guards every user-management route
    activeField: 'isActive',        // default
    profilePermission: 'profile.edit', // guards PATCH /auth/me self-edit
    profileFields: ['name', 'avatarUrl'], // keys a user may edit on own profile
    listFields: ['id', 'email', 'isActive'],
    createFields: ['email', 'password', 'roles'],
    updateFields: ['email', 'isActive'],
    maxLimit: 100,
  },
});
```

Add an `isActive` (bool) column to your User entity if not present.

### Step 14.2: Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `GET /auth/users` | Get | admin | List users (paginated, search `q`, `active`) |
| `GET /auth/users/:id` | Get | admin | Get one user |
| `POST /auth/users` | Post | admin | Create user (may set password/roles) |
| `PATCH /auth/users/:id` | Patch | admin | Update user |
| `POST /auth/users/:id/activate` | Post | admin | Activate |
| `POST /auth/users/:id/deactivate` | Post | admin | Deactivate |
| `DELETE /auth/users/:id` | Delete | admin | Delete user |
| `PATCH /auth/me` | Patch | JWT + `profile.edit` | Self-edit whitelisted fields |

Sensitive fields (password, tokens, codes) are stripped automatically.

---

## Phase 15: API Key Authentication (Optional)

**Risk Level:** Medium (adds a table)
**Estimated Time:** 20-30 minutes

### What's New

`nest-auth@1.4.x` supports `x-api-key` header auth. API keys are bcrypt-hashed, carry a prefix, and can be assigned roles (so `PermissionsGuard` works for key-authenticated requests).

### Step 15.1: Configure

```typescript
AuthModule.forRoot({
  // ...
  apiKey: {
    enabled: true,            // default false
    headerName: 'x-api-key',  // default
    keyPrefix: 'nuk_live_',   // default
    hashRounds: 10,           // default
  },
});
```

### Step 15.2: User Entity & Migration

Add the `api_keys` table (auto-registered via `autoLoadEntities` when the auth module is imported):

```typescript
@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column() userId!: number;
  @Column() name!: string;
  @Column({ select: false }) keyHash!: string;
  @Column() keyPrefix!: string;
  @Column({ default: true }) isActive!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt?: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
```

Schema (Postgres):

```sql
CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY,
  "userId" integer NOT NULL,
  "name" varchar NOT NULL,
  "keyHash" varchar NOT NULL,
  "keyPrefix" varchar NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "lastUsedAt" timestamptz,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "IDX_apk_user" ON "api_keys" ("userId");
```

### Step 15.3: Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `POST /auth/api-keys` | Post | JWT + `admin.access` | Create key (raw key returned once) |
| `GET /auth/api-keys` | Get | JWT + `admin.access` | List caller's keys |
| `DELETE /auth/api-keys/:id` | Delete | JWT + `admin.access` | Revoke key |
| `POST /auth/api-keys/:id/roles/:roleId` | Post | JWT + `admin.access` | Assign role to key |
| `DELETE /auth/api-keys/:id/roles/:roleId` | Delete | JWT + `admin.access` | Remove role from key |

Requests then send `x-api-key: <raw-key>` and are treated as the owning user (with the key's roles) by `JwtAuthGuard`/`PermissionsGuard`.

---

## Phase 16: Notify — FCM Push, SMTP Email & WebSocket (Optional)

**Risk Level:** Medium (adds two tables + controller + optional gateway)
**Estimated Time:** 30-60 minutes

### What's New

`@nest-util/nest-notify@1.1.1` provides FCM push + SMTP email with device-token and history persistence, plus an **optional Socket.IO gateway** for real-time delivery. It is `@Global()` and requires `@nest-util/nest-auth` (uses `@CurrentUser()`).

### Step 16.1: Register the Module

```typescript
import { NestNotifyModule } from '@nest-util/nest-notify';

@Module({
  imports: [
    NestNotifyModule.forRoot({
      fcm: {
        enabled: true,
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: process.env.FCM_PRIVATE_KEY,
      },
      smtp: {
        enabled: true,
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: { address: 'no-reply@example.com', name: 'Example' },
      },
      socket: {
        enable: true,            // optional realtime gateway
        namespace: '/notify',
        cors: { origin: '*', credentials: true },
      },
      controller: { enable: true, path: 'notify' },
    }),
  ],
})
export class AppModule {}
```

`fcm.enabled: true` requires **either** `fcm.app` (pre-built `firebase-admin` App) **or** `projectId`+`clientEmail`+`privateKey`. `smtp.enabled: true` requires **either** `smtp.transport` **or** `host`+`port`+`from.address`.

### Step 16.2: Entities (auto-registered via `autoLoadEntities`)

- `device_tokens` (`DeviceTokenEntity`): unique token, indexed `userId`
- `notifications` (`NotificationEntity`): `channel`, `provider`, `status`, `title`, `body`, `subject`, `to`, `error`, `metadata` (jsonb), `sentAt`

### Step 16.3: Auto-Registered Endpoints

| Endpoint | Method | Auth | Permission Key |
|---|---|---|---|
| `POST /notify/devices` | Post | JWT + Perm | `devices` |
| `GET /notify/devices` | Get | JWT + Perm | `devices` |
| `DELETE /notify/devices` | Delete | JWT + Perm | `devices` |
| `POST /notify/push` | Post | JWT + Perm | `push` |
| `POST /notify/email` | Post | JWT + Perm | `email` |
| `GET /notify/history` | Get | JWT + Perm | `history` |

Permission keys are configurable via `controller.permissions` (`devices`, `push`, `email`, `history`, `mine`) and are applied as `AUTH_PERMISSIONS_METADATA_KEY` so `PermissionsGuard` picks them up. `push`/`email` default to the authenticated user; history is scoped to the user.

### Step 16.4: WebSocket Gateway

When `socket.enable: true`, a Socket.IO gateway connects at `namespace` (default `/notify`) authenticating via `handshake.auth.token` (or `handshake.query.token`). Authenticated connections receive `NotifyService.push` results in real time. You can supply a custom `socket.authorize` to override the default JWT check.

### Checkpoint 16: Notify

- Register a device token → `POST /notify/devices` persists a `device_tokens` row
- `POST /notify/push` → sends via FCM, records `notifications`, prunes dead tokens
- `POST /notify/email` → sends via SMTP
- With `socket.enable`, the client receives pushes over Socket.IO

---

## Phase 17: Standardized Error System (`@nest-util/nest-error`)

**Risk Level:** Medium (new required peer; error-body shape change)
**Estimated Time:** 10-20 minutes
**Rollback:** Install the peer and keep your own global filter (see [Rollback](#rollback-1))

### What's New

A new package, `@nest-util/nest-error`, provides a standardized, localized, **generic**
error system used by every library (`nest-crud`, `nest-auth`, `nest-notify`,
`nest-payment`, `nest-file`):

- `keyed(status, code, params?, safeDetails?)` — throws the real NestJS exception
  class carrying a stable `errorKey` (so `toThrow(...)` / `instanceof` keep working).
- `ErrorKey` — single source of truth for all error codes.
- `LocalizedExceptionFilter` — catch-all filter that renders a consistent JSON body
  driven by `errorKey`, localizes messages, and maps TypeORM unique-violation errors
  (`23505` / errno `1062`) to `DB_DUPLICATE_ENTRY` (HTTP 422) with **no SQL leaked**.
- `LocalizationModule.forRoot(options)` — global module that wires the i18n service,
  language resolver, and the filter (`APP_FILTER`).

This replaces the old per-app `useGlobalFilters(new TypeOrmExceptionFilter())`
duplicate-key handling (see [Troubleshooting](#duplicate-key-errors-23505)).

### Step 17.1: Install the Peer Dependency (Required)

```bash
pnpm add @nest-util/nest-error@^1.0.0
```

Without it, the libraries fail to load (`Cannot find module '@nest-util/nest-error'`).

### Step 17.2: Register `LocalizationModule` (Recommended)

Register it **once** in your root module. It registers the global
`LocalizedExceptionFilter`, so every error — including those from `nest-crud`,
`nest-auth`, etc. — becomes standardized and localized.

```typescript
import { LocalizationModule } from '@nest-util/nest-error';
import errorMessages from './config/error-messages.json';

@Module({
  imports: [
    LocalizationModule.forRoot({
      messages: errorMessages,        // { [lang]: { [errorKey]: 'template' } }
      defaultLang: 'en',
      supportedLangs: ['en'],
      debug: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

`error-messages.json` is deep-merged over the library defaults, so you only override
what you need:

```json
{
  "en": {
    "AUTH_USER_NOT_FOUND": "The requested user was not found",
    "CRUD_RESOURCE_NOT_FOUND": "The requested resource was not found"
  }
}
```

### Step 17.3: Update Client Error Handling

With the filter registered, the error body changes shape:

```json
{
  "status": "error",
  "code": "CRUD_RESOURCE_NOT_FOUND",
  "message": "The requested resource was not found",
  "statusCode": 404,
  "details": null,
  "timestamp": "2026-08-22T12:00:00.000Z",
  "path": "/posts/42"
}
```

- The old `error` field (`"Not Found"`) is **removed** — read `body.code` / `body.errorKey` instead.
- `body.message` is again a localized **string** (English wording may differ from before).
- If you skip Step 17.2, `body.message` is an **object** (`{ errorKey, params, details, message }`) — a hard break for clients that parse `message` as a string.

### Step 17.4: Remove the Old `TypeOrmExceptionFilter`

The new filter already handles `23505` duplicate-key errors, so the manual global
filter is no longer needed:

```diff
   const app = await NestFactory.create(AppModule);
-  app.useGlobalFilters(new TypeOrmExceptionFilter());
   // ...
```

### Checkpoint 17: Error System

- A duplicate-key insert returns `422` with `code: "DB_DUPLICATE_ENTRY"` (no SQL leaked)
- A `404` returns `code: "..."` and a localized `message`
- `body.error` is no longer present; clients use `body.code`
- `pnpm run build && pnpm test` pass

> Full details, override examples, and troubleshooting: see the
> [Nest Error Migration Guide](./NEST-ERROR-MIGRATION-GUIDE.md).

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
| POST /auth/verify | Verify registration OTP | 200 |
| POST /auth/verify/resend | Resend verification OTP | 200 |
| POST /auth/otp/request | Request OTP | 200 |
| POST /auth/otp/login | Login with OTP | 200 + tokens |
| POST /auth/password-reset/request | Request reset | 200 |
| POST /auth/password-reset/reset | Reset password | 200 |
| POST /auth/onboarding/start | Start onboarding | 200 |
| POST /auth/onboarding/complete | Complete onboarding | 200 + token |
| POST /auth/onboarding/user | Create onboarded user | 201 |
| GET /auth/users | List users (admin) | 200 |
| PATCH /auth/me | Self-edit profile | 200 |
| POST /auth/api-keys | Create API key (admin) | 201 |
| POST /post | Create post | 201 + audit log |
| GET /post | List posts | 200 + pagination |
| GET /post/:id | Get post | 200 |
| PATCH /post/:id | Update post | 200 + audit log |
| POST /post/:id/status | Change status | 200 (if statusPipeline) |
| GET /post/:id/approval | Get approval | 200 (if approvalPipeline) |
| POST /post/:id/approval/approve | Approve | 200 (if approvalPipeline) |
| POST /post/:id/approval/request-modification | Request mods | 200 (if approvalPipeline) |
| POST /post/:id/approval/resubmit | Resubmit | 200 (if approvalPipeline) |
| DELETE /post/:id | Delete post | 200 + audit log |
| GET /post/auditlogs | Audit logs | 200 |
| GET /post/mine | User's posts | 200 (if enabled) |
| GET /post?filter[title_cont]=hello | Filter | 200 |
| GET /post?orderBy=title&orderDirection=ASC | Sort | 200 |
| GET /post?cursor=xxx&limit=10 | Cursor pagination | 200 |
| POST /notify/devices | Register device | 201 (if notify) |
| POST /notify/push | Push | 200 (if notify) |
| POST /notify/email | Email | 200 (if notify) |

### Swagger Documentation

Verify Swagger UI renders all endpoints correctly (typically at `/api` or `/docs`), including the new `status`, `approval/*`, `verify`, `onboarding/*`, `users`, `api-keys`, and `notify/*` routes.

---

## Troubleshooting

### "Cannot find module '@nest-util/nest-audit'"

You still have imports from the deleted package. Find and replace all occurrences:

```bash
grep -r "@nest-util/nest-audit" --include="*.ts" .
```

Replace every occurrence with `@nest-util/nest-crud`. See [Phase 2, Step 2.2](#step-22-replace-all-imports).

### "Entity is not registered" (audit / approval)

Ensure `autoLoadEntities: true` is set on your `TypeOrmModule.forRoot()`. `NestCrudModule` registers `AuditLogEntity`, `ApprovalStatusEntity`, and `ModificationRequestHistoryEntity`.

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

### Status transition rejected / "invalid transition"

- The target status must be listed in `statusPipeline.transitions` for the current `from` value.
- If the edge declares `permission`, the caller must have it in resolved permissions.
- A create payload may only set a status in `allowCreateStatuses` (defaults to `[initial]`).

### Approval endpoints return 404

`approvalPipeline` must be present in the **service** options. The `approval/*` endpoints are auto-generated by `CreateNestedCrudController` and are gated by `disabledEndpoints`.

### "approval_statuses / api_keys table does not exist"

These tables are registered automatically only when the owning module (`NestCrudModule` for approval, `AuthModule` for api-keys) is imported **and** `autoLoadEntities: true` is set. Generate and run a migration (see Phase 8 / Phase 15).

### Throttler / 429 not working

`@nestjs/throttler` must be installed for `rateLimit` to function. If it is missing, set `rateLimit.enabled: false` or omit the block.

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

The standardized error system (`@nest-util/nest-error`) maps TypeORM unique-violation
errors (`23505` / errno `1062`) to `DB_DUPLICATE_ENTRY` (HTTP 422) with no SQL
leaked. This is handled automatically by the `LocalizedExceptionFilter` registered by
`LocalizationModule.forRoot()` ([Phase 17](#phase-17-standardized-error-system-nest-utilnest-error)).

If you have **not** adopted `LocalizationModule`, you can still register the older
`TypeOrmExceptionFilter` from `@nest-util/nest-crud` as a global filter in your
`main.ts`:

```typescript
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new TypeOrmExceptionFilter());
  // ...
}
```

Prefer `LocalizationModule.forRoot()` — it covers all error codes, not just duplicate
keys, and produces the standardized body.

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
3. **ALWAYS** ensure `autoLoadEntities: true` on `TypeOrmModule.forRoot()` (required for `AuditLogEntity`, `ApprovalStatusEntity`, `ModificationRequestHistoryEntity`, `ApiKeyEntity`, and notify entities)
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

### Ownership Enforcement

1. **ALWAYS** set `enforceOwnership: true` only when `userOwnershipField` or `findMineQuery` is configured
2. **ALWAYS** configure bypass permissions for admin roles (e.g. `ownershipBypassPermissions: ['admin.access']`)
3. **ALWAYS** verify endpoints return 404 for non-owned records and 403 for unauthenticated requests
4. **NEVER** enable enforcement without authentication guards on the controller

### Status & Approval Pipelines

1. **ALWAYS** add a DB migration for the status column / `approval_statuses` / `approval_modification_history` tables
2. **ALWAYS** seed `initial` status and `allowCreateStatuses` so existing rows stay valid
3. **ALWAYS** declare per-edge `permission` when the transition must be gated
4. **NEVER** let unauthenticated callers reach `approve`/`reject` when permissions are configured

### Auth Hardening

1. **ALWAYS** install `@nestjs/throttler` before enabling `rateLimit`
2. **ALWAYS** add the `loginAttempts` / `passwordReset` counter columns to the User entity and migrate
3. **NEVER** enable rate limiting in tests without accounting for `429` responses

### User Management, Profile & API Keys

1. **ALWAYS** guard user-management routes with `admin.access` (default) — never expose `POST /auth/users` publicly
2. **ALWAYS** migrate the `api_keys` table when `apiKey.enabled: true`
3. **ALWAYS** set `profileFields` so users can only edit safe columns via `PATCH /auth/me`
4. **NEVER** return raw API keys after creation except in the create response

### Notify

1. **ALWAYS** provide FCM credentials or a pre-built app when `fcm.enabled: true`
2. **ALWAYS** provide SMTP transport/host or disable `smtp.enabled`
3. **ALWAYS** scope `notify/push` and `notify/email` to the authenticated user

### Standardized Error System

1. **ALWAYS** `pnpm add @nest-util/nest-error` (required peer) when upgrading any nest-util library
2. **ALWAYS** register `LocalizationModule.forRoot(...)` so errors render as the standardized body (otherwise `message` is an object)
3. **ALWAYS** update clients to read `body.code` / `body.errorKey` instead of the removed `body.error`
4. **NEVER** rely on exact English error strings — assert on `errorKey` and override wording via `error-messages.json`
5. **NEVER** leak SQL/stack by enabling `debug` in production

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
pnpm add @nest-util/nest-crud@^1.2.2 @nest-util/nest-auth@^1.4.5 typeorm@^1.1.0
pnpm add @nestjs/common@^11.0.0 @nestjs/core@^11.0.0 @nestjs/swagger@^11.2.6 @nestjs/typeorm@^11.0.1
pnpm add express@^5.2.1
pnpm add @nest-util/nest-notify@^1.1.1        # if you want notifications
pnpm add @nestjs/throttler                     # if you enable auth rate limiting

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

# Step 8: Enable opt-in features (each needs a DB migration + service/controller config)
#   - statusPipeline / approvalPipeline  (nest-crud service options)
#   - rateLimit / loginAttempts / passwordReset / verification / onboarding /
#     registerHooks / identifierFields / userManagement / apiKey  (nest-auth forRoot)
#   - NestNotifyModule.forRoot(...)  (nest-notify)

# Step 9: Verify
npm run build
npm test
```

