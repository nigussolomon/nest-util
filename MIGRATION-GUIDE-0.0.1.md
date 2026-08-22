# Migration Guide: @nest-util 0.0.1 → latest (v1.x)

> **Audience:** Projects pinned to the library state at commit `54e2dce`
> ("feat: Add ordering capabilities to findAll…"). At that commit the published
> packages were **`@nest-util/nest-crud@0.0.1`** and **`@nest-util/nest-auth@0.0.1`**.
> `@nest-util/nest-notify` and `@nest-util/nest-audit` did not yet exist in their
> current form (`nest-audit` was still a **separate** package you depended on).

**Target versions:** `@nest-util/nest-crud@1.2.2`, `@nest-util/nest-auth@1.4.5`, `@nest-util/nest-notify@1.1.1`.

This file covers the **required/breaking changes** to get from `0.0.1` to `1.x`.
The **opt-in feature adoption** phases (hooks, findMine, ownership, cursor, status
pipeline, approval pipeline, audit event bus, auth hardening, verification, onboarding,
register hooks, user management, API keys, notify) live in the main
[MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) — this file tells you which of those are
**new to you** and links to the relevant phase.

---

## What Your 0.0.1 Project Looks Like

| Area | At `54e2dce` (0.0.1) | At latest (1.x) |
|---|---|---|
| `@nest-util/nest-crud` | `0.0.1` | `1.2.2` |
| `@nest-util/nest-auth` | `0.0.1` | `1.4.5` |
| `@nest-util/nest-audit` | **separate package** (you import `Audit`, `AuditLogEntity`, `AuditInterceptor`, `AuditService`, `ListAuditLogsDto` from it) | **deleted** — re-exported from `nest-crud` |
| `@nest-util/nest-notify` | not published | `1.1.1` (new) |
| `typeorm` | `^0.3.28` | `^1.1.0` |
| `@nestjs/common` / `@nestjs/core` | `^11.0.0` | `^11.0.0` (no change) |
| `express` | `^5.2.1` | `^5.2.1` (no change) |
| CRUD controller factory opts | `{ permissions }` only | `{ permissions, enableFindMine }` |
| CRUD service options | `repository`, `allowedFilters`, `allowedSortFields`, `include`, `relations`, `toResponseDto`, `createDtoClass`, `updateDtoClass`, `disabledEndpoints` | + `hooks`, `userOwnershipField`, `findMineQuery`, `enforceOwnership`, `ownershipBypass*`, `superAdminPermission`, `cursorStrategy`, `statusPipeline`, `approvalPipeline` |
| CRUD endpoints | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `GET /auditlogs`, `GET /:id` | + `GET /mine`, `POST /:id/status`, `GET /:id/approval`, `POST /:id/approval/*` (6), `GET /?cursor=` |
| Auth endpoints | `register`, `login`, `refresh`, `me`, `me/permissions`, `logout`, `permissions`, `roles`, `roles/:roleId/permissions`, `users/:userId/roles(/:roleId)` | + `otp/*`, `password-reset/*`, `verify`, `verify/resend`, `onboarding/*`, `users` (admin CRUD), `api-keys` |
| Auth module options | `identifierField`, `passkeyField`, `jwtSecret`, `expiresIn`, `refresh*`, `disabledRoutes`, `login/register/refreshDto`, `relations`, `rbac`, `permissionRegistry` | + `identifierFields`, `otp`, `passwordReset`, `rateLimit`, `loginAttempts`, `apiKey`, `userManagement`, `verification`, `onboarding`, `registerHooks` |

> **Good news:** Because `54e2dce` was already on NestJS 11 and Express 5, the
> *"NestJS 10 → 11"* and *"Express 4 → 5"* breaking changes listed in the main guide
> **do not apply to you**. You only need the TypeORM 0.3 → 1.1 codemod and the
> `nest-audit` removal.

---

## Quick Reference

```bash
# 1. Upgrade dependencies
pnpm add @nest-util/nest-crud@^1.2.2 @nest-util/nest-auth@^1.4.5 typeorm@^1.1.0
pnpm add @nestjs/typeorm@^11.0.1
# (NestJS common/core/swagger and express are already at the right majors)

# Optional new packages
pnpm add @nest-util/nest-notify@^1.1.1     # push/email/websocket notifications
pnpm add @nestjs/throttler                  # only if you enable auth rate limiting

# 2. Remove the now-deleted audit package
pnpm remove @nest-util/nest-audit

# 3. Find & replace all nest-audit imports -> nest-crud (see Phase 3)
grep -r "@nest-util/nest-audit" --include="*.ts" .

# 4. Run the TypeORM 0.3 -> 1.1 codemod
npx @typeorm/codemod v1

# 5. Remove entitySkipConstructor (if present) + set autoLoadEntities: true
# 6. Verify
npm run build && npm test
```

---

## What Changed (Breaking / Required)

| Change | Applies to you? | Action |
|---|---|---|
| `@nest-util/nest-audit` deleted | **Yes** | Replace imports with `@nest-util/nest-crud`; remove `NestUtilNestAuditModule` |
| TypeORM `0.3.28` → `1.1.0` | **Yes** | Run `npx @typeorm/codemod v1`; remove `entitySkipConstructor` |
| NestJS `10` → `11` | No (already 11) | — |
| Express `4` → `5` | No (already 5) | — |
| `CreateNestedCrudController` `findOne`/`create`/`update` now accept an optional `@CurrentUser()` | **Yes (source change)** | Add `implements IBaseController<CD, UD, RD>` to controllers (avoids TS2742) |

All other changes in `1.x` are **opt-in** (new endpoints/options) and are documented in the linked phases.

---

## Pre-Migration Checklist

- [ ] Clean working tree (commit or stash)
- [ ] Tests passing on `0.0.1`
- [ ] Node.js >= 18.x
- [ ] Access to your database
- [ ] Confirm `package.json` lists `@nest-util/nest-audit` as a dependency (you're about to remove it)

```bash
git checkout -b upgrade/nest-util-1.x
npm test
```

---

## Phase 1: Upgrade Dependencies

**File:** `package.json`

```json
{
  "dependencies": {
    "@nest-util/nest-crud": "^1.2.2",
    "@nest-util/nest-auth": "^1.4.5",
    "typeorm": "^1.1.0",
    "@nestjs/typeorm": "^11.0.1"
  }
}
```

```bash
pnpm install
```

> Do **not** downgrade or change `@nestjs/common`, `@nestjs/core`, or `express` —
> they are already at the majors `1.x` requires.

---

## Phase 2: Run the TypeORM 0.3 → 1.1 Codemod

This is the one genuinely breaking framework bump for you (TypeORM `0.3.28` → `1.1.0`).

```bash
npx @typeorm/codemod v1
```

**What it automates:**
- Renames `connection` → `dataSource` in metadata classes
- Flags removed APIs and suggests replacements
- Updates import paths

**`entitySkipConstructor`:** if your `TypeOrmModule.forRoot()` / `DataSource` config
uses `entitySkipConstructor: true`, remove it (it was removed in TypeORM 1.x):

```diff
  TypeOrmModule.forRoot({
    type: 'postgres',
-   entitySkipConstructor: true,
  })
```

**Guardrail:** Review every diff the codemod produces before committing.

---

## Phase 3: Remove `@nest-util/nest-audit`

At `0.0.1` you imported audit symbols from the separate `@nest-util/nest-audit`
package. In `1.x` they live in `@nest-util/nest-crud`.

### Step 3.1: Find All Imports

```bash
grep -r "@nest-util/nest-audit" --include="*.ts" .
```

### Step 3.2: Replace Imports

| Old Import (0.0.1) | New Import (1.x) |
|---|---|
| `import { Audit } from '@nest-util/nest-audit'` | `import { Audit } from '@nest-util/nest-crud'` |
| `import { AuditLogEntity } from '@nest-util/nest-audit'` | `import { AuditLogEntity } from '@nest-util/nest-crud'` |
| `import { AuditInterceptor } from '@nest-util/nest-audit'` | `import { AuditInterceptor } from '@nest-util/nest-crud'` |
| `import { AuditService } from '@nest-util/nest-audit'` | `import { AuditService } from '@nest-util/nest-crud'` |
| `import { ListAuditLogsDto } from '@nest-util/nest-audit'` | `import { ListAuditLogsDto } from '@nest-util/nest-crud'` |

```bash
find . -name "*.ts" -exec sed -i "s/from '@nest-util\/nest-audit'/from '@nest-util\/nest-crud'/g" {} +
```

### Step 3.3: Remove `NestUtilNestAuditModule`

```diff
  import { NestCrudModule } from '@nest-util/nest-crud';
- import { NestUtilNestAuditModule } from '@nest-util/nest-audit';
- import { AuditInterceptor } from '@nest-util/nest-audit';
+ import { AuditInterceptor } from '@nest-util/nest-crud';

  @Module({
    imports: [
      TypeOrmModule.forRoot({ type: 'postgres', autoLoadEntities: true, /* ... */ }),
      NestCrudModule,
-     NestUtilNestAuditModule,   // ← REMOVE
      AuthModule.forRoot({ /* ... */ }),
    ],
    providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  })
  export class AppModule {}
```

### Step 3.4: `autoLoadEntities: true` is now Required

`NestCrudModule` registers `AuditLogEntity` (and, if you later enable the approval
pipeline, `ApprovalStatusEntity` / `ModificationRequestHistoryEntity`) with TypeORM.
Ensure:

```typescript
TypeOrmModule.forRoot({ type: 'postgres', autoLoadEntities: true, /* ... */ });
```

### Step 3.5: Uninstall

```bash
pnpm remove @nest-util/nest-audit
```

---

## Phase 4: Required Source Adjustments

Even after the import swap, two source-level changes are needed so your `0.0.1`-era
code compiles against `1.x`.

### 4.1: Add `implements IBaseController<CD, UD, RD>` to Controllers

The controller factory's method signatures changed (e.g. `findOne(id, user?)`,
`create(dto, user?)`). To avoid `TS2742: inferred type is not portable`, add the
interface implementation to every controller that extends `CreateNestedCrudController(...)`:

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

### 4.2: `Audit` Decorator Still Works

`@Audit({ action: 'CREATE' })` is unchanged — it is now re-exported from
`@nest-util/nest-crud`. No code change beyond the import path.

### 4.3: Service Options You Already Used Are Unchanged

`repository`, `allowedFilters`, `allowedSortFields`, `include`, `relations`,
`toResponseDto`, `createDtoClass`, `updateDtoClass`, `disabledEndpoints` all still
exist with the same semantics. No edits required unless you later adopt new options.

### Checkpoint 4

```bash
npm run build
npm test
```

Your existing CRUD + auth behavior (register/login/refresh/roles/permissions,
audit logging, filtering, ordering) must still work.

---

## Phase 5: Adopt New Features (All Opt-In)

Everything below is **new since your `0.0.1` pin**. Each is optional — enable only
what you need. Detailed steps are in the linked phase of
[MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md).

| Feature | New to you? | Guide phase |
|---|---|---|
| Lifecycle hooks (`beforeCreate`, …) | ✅ | Phase 3 |
| `findMine` (`GET /mine`) | ✅ | Phase 4 |
| Ownership enforcement | ✅ | Phase 5 |
| Cursor pagination (`?cursor=`) | ✅ | Phase 6 |
| `relations` FK resolution | ⚠️ exists in 0.0.1 already | Phase 6 (reference) |
| Status pipeline (`POST /:id/status`) | ✅ | Phase 7 |
| Approval pipeline (`/approval/*`) | ✅ | Phase 8 |

> **Note — approval pipeline status change:** the reviewable state was renamed
> `pending` → `submitted`, and a new `draft` initial state plus a `submit` step
> (`POST /:id/approval/submit`) were added. If you already had the older
> `pending`-based pipeline enabled, existing `approval_statuses` rows must be
> remapped. See [MIGRATION-APPROVAL-PIPELINE.md](./MIGRATION-APPROVAL-PIPELINE.md).
| Audit event bus | ✅ | Phase 9 |
| Auth rate limiting / login lockout / reset abuse | ✅ | Phase 10 |
| Registration verification (OTP) | ✅ | Phase 11 |
| Assisted onboarding | ✅ | Phase 12 |
| Registration hooks & multi-identifier login | ✅ | Phase 13 |
| User management & profile endpoints | ✅ | Phase 14 |
| API key auth | ✅ | Phase 15 |
| Notify (FCM/SMTP/WebSocket) | ✅ (new package) | Phase 16 |

> Note: at `0.0.1` you already had `relations` FK resolution, filtering, and
> `orderBy`/`orderDirection` ordering — those are not migrations, just keep using them.

---

## Post-Migration Verification

```bash
npm run build
npm test
```

Smoke-test your **existing** surface first (must still pass):

| Endpoint | Expected |
|---|---|
| POST /auth/register | 201 |
| POST /auth/login | 200 + tokens |
| POST /auth/refresh | 200 + tokens |
| GET /auth/me | 200 |
| POST /post | 201 + audit log |
| GET /post | 200 + pagination/ordering |
| PATCH /post/:id | 200 + audit log |
| DELETE /post/:id | 200 + audit log |
| GET /post/auditlogs | 200 |

Then, if you adopted any opt-in feature, follow the corresponding phase's checkpoint
in the main guide.

---

## Troubleshooting

### "Cannot find module '@nest-util/nest-audit'"
You missed an import. Re-run:
```bash
grep -r "@nest-util/nest-audit" --include="*.ts" .
```
and replace with `@nest-util/nest-crud`.

### "AuditLogEntity is not registered"
Set `autoLoadEntities: true` on `TypeOrmModule.forRoot()` (see Phase 3.4).

### TypeORM 1.x errors after codemod
```bash
npx @typeorm/codemod v1
```
Also remove `entitySkipConstructor: true` if present. `SelectQueryBuilder` is now
imported from `typeorm` directly.

### TS2742: inferred type is not portable
Add `implements IBaseController<CD, UD, RD>` (see Phase 4.1).

### Filter / ordering queries not working
Set the Express query parser to `extended` in `main.ts` (required since `1.0`):
```typescript
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```
You already had `orderBy`/`orderDirection` at `0.0.1`, but the `extended` parser is
what makes `filter[field_operator]` nested query objects parse — confirm it's set.

---

## Agent Guardrails

1. **ALWAYS** run `npx @typeorm/codemod v1` and review every change
2. **ALWAYS** replace every `@nest-util/nest-audit` import with `@nest-util/nest-crud`
3. **ALWAYS** remove `NestUtilNestAuditModule` and `pnpm remove @nest-util/nest-audit`
4. **ALWAYS** set `autoLoadEntities: true`
5. **ALWAYS** add `implements IBaseController<CD, UD, RD>` to CRUD controllers
6. **NEVER** change `@nestjs/common` / `@nestjs/core` / `express` — already on the right majors
7. **ALWAYS** run tests after Phases 2, 3, and 4 before adopting opt-in features

---

## Summary

```bash
# 1. Upgrade
pnpm add @nest-util/nest-crud@^1.2.2 @nest-util/nest-auth@^1.4.5 typeorm@^1.1.0
pnpm add @nestjs/typeorm@^11.0.1
pnpm add @nest-util/nest-notify@^1.1.1          # optional
pnpm add @nestjs/throttler                       # optional (rate limiting)

# 2. Remove audit package
pnpm remove @nest-util/nest-audit

# 3. Replace imports
grep -r "@nest-util/nest-audit" --include="*.ts" .
# -> replace each with @nest-util/nest-crud

# 4. TypeORM codemod
npx @typeorm/codemod v1
# remove entitySkipConstructor if present

# 5. autoLoadEntities: true + remove NestUtilNestAuditModule

# 6. Add `implements IBaseController<CD, UD, RD>` to controllers

# 7. Verify
npm run build && npm test

# 8. Optionally adopt new features (see MIGRATION-GUIDE.md Phases 3-16)
```
