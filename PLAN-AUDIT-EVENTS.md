# PLAN: Pluggable Audit Event System

## Overview

Add a pluggable event emitter system to `@nest-util/nest-crud` and `@nest-util/nest-auth`. The library emits structured audit events for all CRUD operations, auth operations, guard denials, and RBAC changes. Consumer apps plug in their own handlers (PostHog, Sentry, custom) via a simple interface.

**Dependency**: `@nestjs/event-emitter` (wraps `eventemitter2`)

## Architecture

```
Consumer App
  AuditEventModule.forRoot({ handlers: [PostHogHandler, SentryHandler] })
         │
         ▼
  AuditEventListener (internal)
    ├── dispatches to ConsoleHandler (built-in)
    └── dispatches to consumer-provided handlers
         │
         ▼
  EventEmitter2 (@nestjs/event-emitter)
         ▲
         │
  ┌──────┴──────┐
  │ nest-crud   │  AuditInterceptor emits: crud.*.success, crud.*.error
  │ nest-auth   │  AuthService emits: auth.*.success, auth.*.failed
  │             │  Guards emit: auth.jwt.denied, auth.permissions.denied
  └─────────────┘
```

## Event Interface

```typescript
// libs/nest-crud/src/lib/events/audit-event.interface.ts

export interface AuditEvent {
  /** Dot-separated event name, e.g. 'auth.user.login.success' */
  action: string;
  /** Entity type: 'user', 'role', 'post', etc. */
  entity: string;
  /** ID of the affected entity (optional for list/search events) */
  entityId?: string | number;
  /** ID of the user performing the action */
  userId?: string | number;
  /** Client IP address */
  ip?: string;
  /** User-Agent header */
  userAgent?: string;
  /** Multi-tenant ID */
  tenantId?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Arbitrary event-specific data */
  metadata?: Record<string, unknown>;
}

export interface AuditEventHandler {
  handle(event: AuditEvent): void | Promise<void>;
}
```

## Configuration

```typescript
export interface AuditEventModuleOptions {
  /** Handlers to dispatch events to */
  handlers: AuditEventHandler[];
  /** Glob patterns to include (default: ['*']) */
  include?: string[];
  /** Glob patterns to exclude (default: []) */
  exclude?: string[];
}
```

## Files to Create (5)

### 1. `libs/nest-crud/src/lib/events/audit-event.interface.ts`
- `AuditEvent` interface
- `AuditEventHandler` interface
- `AuditEventModuleOptions` interface
- Event name constants (optional, for type safety)

### 2. `libs/nest-crud/src/lib/events/audit-event.module.ts`
- `AuditEventModule.forRoot(options)` — dynamic module
- Registers `EventEmitterModule.forRoot()` as import
- Provides `AuditEventHandler[]` via `providers`
- Provides `AuditEventModuleOptions` via `providers`
- Exports `EventEmitter2`

### 3. `libs/nest-crud/src/lib/events/audit-event.listener.ts`
- `@Injectable()` class
- `@OnEvent('*')` handler (wildcard listener)
- Receives all events, filters by `include`/`exclude` patterns
- Dispatches to registered handlers (parallel, with error isolation)
- Uses `minimatch` or simple glob matching for patterns

### 4. `libs/nest-crud/src/lib/events/handlers/console.handler.ts`
- `ConsoleHandler implements AuditEventHandler`
- Pretty-prints events to stdout with colors
- Format: `[TIMESTAMP] ACTION entity=USER id=123 userId=456 ip=1.2.3.4`

### 5. `libs/nest-crud/src/lib/events/index.ts`
- Barrel exports for all event types

## Files to Modify (11)

### 6. `libs/nest-crud/src/lib/interceptors/audit-log.interceptor.ts`
Current state: Only logs on success via `tap()`, no error handling, no entityId extraction.

Changes:
- Inject `EventEmitter2`
- Extract `entityId` from `request.params?.id` (pre-handle)
- Add `catchError()` pipe to emit error events
- Emit events alongside existing `auditService.log()` calls
- Event names: `crud.<entity>.<action>.success` / `.error`

### 7. `libs/nest-crud/src/lib/nest-crud.module.ts`
Current state: Only provides `AuditService` and `AuditLogEntity`.

Changes:
- Import `AuditEventModule` (optional, consumer controls via `forRoot()`)

### 8. `libs/nest-crud/src/lib/interfaces/audit-log.interface.ts`
Changes:
- Export `AuditEvent`, `AuditEventHandler`, `AuditEventModuleOptions` from events

### 9. `libs/nest-crud/src/index.ts`
Changes:
- Add `export * from './lib/events'`

### 10. `libs/nest-crud/package.json`
Changes:
- Add `"@nestjs/event-emitter"` to `peerDependencies`

### 11. `libs/nest-auth/src/lib/services/auth.service.ts`
Current state: No event emission, no logger.

Changes:
- Inject `EventEmitter2` (optional — graceful no-op if not provided)
- Emit events at every success/failure branch in:
  - `register()` → 2 events
  - `login()` → 3 events
  - `requestOtp()` → 5 events
  - `loginWithOtp()` → 7 events
  - `refresh()` → 2 events
  - `logout()` → 2 events
  - `changePassword()` → 4 events
  - `requestPasswordReset()` → 3 events
  - `resetPassword()` → 3 events
  - `createRole()` → 2 events
  - `assignRoleToUser()` → 2 events (success + already exists)
  - `removeRoleFromUser()` → 1 event
  - `assignPermissionsToRole()` → 2 events
  - `removePermissionsFromRole()` → 2 events

### 12. `libs/nest-auth/src/lib/guards/jwt-auth.guard.ts`
Changes:
- Inject `EventEmitter2` (optional)
- Emit `auth.jwt.denied` in `handleRequest()` when user is null

### 13. `libs/nest-auth/src/lib/guards/permissions.guard.ts`
Changes:
- Inject `EventEmitter2` (optional)
- Emit `auth.permissions.denied` in `canActivate()` when permissions check fails

### 14. `libs/nest-auth/src/lib/auth.module.ts`
Changes:
- Import `AuditEventModule`

### 15. `libs/nest-auth/package.json`
Changes:
- Add `"@nestjs/event-emitter"` to `peerDependencies`

## Complete Event Catalog (52 events)

### CRUD Events (12)

| Event | When | Key payload fields |
|---|---|---|
| `crud.<entity>.create.success` | Entity created | entityId (from result), body, response |
| `crud.<entity>.create.error` | Create failed | body, error |
| `crud.<entity>.update.success` | Entity updated | entityId (from params), body, response |
| `crud.<entity>.update.error` | Update failed | entityId, body, error |
| `crud.<entity>.delete.success` | Entity deleted | entityId (from params) |
| `crud.<entity>.delete.error` | Delete failed | entityId, error |
| `crud.<entity>.findAll.success` | List query | query, response count |
| `crud.<entity>.findAll.error` | List query failed | query, error |
| `crud.<entity>.findOne.success` | Single entity fetched | entityId, response |
| `crud.<entity>.findOne.error` | Fetch failed | entityId, error |
| `crud.<entity>.findMine.success` | User-scoped list | userId, query, response count |
| `crud.<entity>.findMine.error` | User-scoped list failed | userId, query, error |

### Auth Events (25)

| Event | When |
|---|---|
| `auth.user.register.success` | User created |
| `auth.user.register.conflict` | User already exists |
| `auth.user.login.success` | Password login successful |
| `auth.user.login.failed.user_not_found` | No user by identifier |
| `auth.user.login.failed.invalid_password` | Wrong password |
| `auth.otp.request.success` | OTP sent |
| `auth.otp.request.user_not_found` | Unknown identifier (info, not error) |
| `auth.otp.request.locked` | Account locked |
| `auth.otp.request.cooldown` | Too soon after last OTP |
| `auth.otp.request.delivery_failed` | Deliver callback threw |
| `auth.otp.login.success` | OTP login successful |
| `auth.otp.login.failed.user_not_found` | Unknown identifier |
| `auth.otp.login.failed.expired` | OTP expired |
| `auth.otp.login.failed.invalid` | Wrong OTP code |
| `auth.otp.login.failed.max_attempts` | Max attempts exceeded |
| `auth.otp.login.failed.locked` | Account locked |
| `auth.otp.login.failed.not_requested` | No OTP generated |
| `auth.token.refresh.success` | New tokens issued |
| `auth.token.refresh.failed` | Invalid refresh token |
| `auth.user.logout.success` | Sessions cleared |
| `auth.user.logout.failed` | No user affected |
| `auth.password.change.success` | Password changed |
| `auth.password.change.failed.current_password_wrong` | Wrong current password |
| `auth.password.change.failed.user_not_found` | User not found |
| `auth.password.change.failed.no_password_set` | User has no password |

### Password Reset Events (5)

| Event | When |
|---|---|
| `auth.password.reset.request.success` | Reset token generated |
| `auth.password.reset.request.delivery_failed` | Deliver callback threw |
| `auth.password.reset.success` | Password reset, sessions invalidated |
| `auth.password.reset.failed.invalid_token` | No matching token |
| `auth.password.reset.failed.expired` | Token expired |

### RBAC Events (8)

| Event | When |
|---|---|
| `auth.role.created` | Role created |
| `auth.role.created.conflict` | Role name exists |
| `auth.role.assigned` | Role assigned to user |
| `auth.role.removed` | Role removed from user |
| `auth.role.permissions.added` | Permissions merged into role |
| `auth.role.permissions.removed` | Permissions removed from role |

### Guard Events (3)

| Event | When |
|---|---|
| `auth.jwt.denied` | JWT auth failed (401) |
| `auth.permissions.denied` | Missing permissions (403) |
| `auth.route.disabled` | Route is disabled |

### Info Events (4)

| Event | When |
|---|---|
| `auth.user.validated` | Passport validation |
| `auth.profile.accessed` | GET /auth/me |
| `auth.permissions.accessed` | GET /auth/me/permissions |
| `auth.roles.listed` | GET /auth/roles |

## Consumer Examples

### PostHog Handler
```typescript
import { AuditEventHandler, AuditEvent } from '@nest-util/nest-crud';
import { PostHog } from 'posthog-node';

export class PostHogHandler implements AuditEventHandler {
  private client: PostHog;
  constructor(apiKey: string) {
    this.client = new PostHog(apiKey);
  }
  async handle(event: AuditEvent): Promise<void> {
    this.client.capture({
      distinctId: String(event.userId ?? 'anonymous'),
      event: event.action,
      properties: {
        entity: event.entity,
        entityId: event.entityId,
        ip: event.ip,
        ...event.metadata,
      },
    });
  }
}
```

### Sentry Handler
```typescript
import { AuditEventHandler, AuditEvent } from '@nest-util/nest-crud';
import * as Sentry from '@sentry/node';

export class SentryHandler implements AuditEventHandler {
  handle(event: AuditEvent): void {
    if (event.action.includes('.failed') || event.action.includes('.denied')) {
      Sentry.captureMessage(event.action, 'warning');
    }
  }
}
```

### Registration
```typescript
// app.module.ts
AuditEventModule.forRoot({
  handlers: [
    new ConsoleHandler(),
    new PostHogHandler('ph_key'),
    new SentryHandler(),
  ],
  include: ['auth.*', 'crud.*'],
  exclude: ['crud.post.findAll.*'],
})
```

## Execution Order

1. **Phase 1**: Core event bus — create 5 new files
2. **Phase 2**: CRUD interceptor — modify 1 file
3. **Phase 3**: Auth service — modify 1 file (largest, ~25 emit calls)
4. **Phase 4**: Guards — modify 2 files
5. **Phase 5**: Package deps + exports — modify 4 files
6. **Phase 6**: Docs + skills — update HTML, markdown, both SKILL.md files

Each phase should be buildable and testable independently.
