# nest-crud Setup Guide

This guide reflects the implementation in `libs/nest-crud`.

## 1) Install

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^2.0.1 @nest-util/nest-error@^1.0.0 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger class-validator class-transformer
# Optional — for guard integration in section 3
pnpm add @nest-util/nest-auth@^2.0.1 @nestjs/jwt @nestjs/passport bcrypt
```

`@nest-util/nest-error` is a required peer dependency. `@nest-util/nest-auth` is
optional and only needed if you use `JwtAuthGuard` / `PermissionsGuard`.

`@nest-util/nest-crud` includes audit logging, lifecycle hooks, cursor pagination,
findMine, ownership enforcement, status pipelines, approval pipelines, and a
testing factory — all built-in.

## 2) Build a Service with `NestCrudService`

Create your resource service by extending `NestCrudService`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title'],
      include: ['author'],
      disabledEndpoints: [],
    });
  }
}
```

### Service Options

```ts
interface CrudServiceOptions<Entity, ResponseDto> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity)[];
  allowedSortFields?: readonly (keyof Entity)[];
  include?: readonly string[];
  relations?: { property: keyof Entity; repo: Repository<ObjectLiteral>; idField?: string; }[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
  disabledEndpoints?: readonly CrudEndpoint[];
  cursorStrategy?: CursorStrategy;          // override auto-detection
  hooks?: CrudHooks<Entity, any, any>;      // lifecycle hooks
  transactionConfig?: TransactionConfig;    // isolation level for hooks
  userOwnershipField?: keyof Entity;        // ownership column for findMine
  findMineQuery?: (qb, userId) => void;     // custom findMine query
  enforceOwnership?: boolean;               // scope read/update/delete to owner
  ownershipBypassPermissions?: readonly string[]; // permissions that bypass ownership
  ownershipBypass?: (user: OwnershipUser) => boolean; // custom ownership bypass
  superAdminPermission?: string;            // permission that skips ownership checks
  statusPipeline?: StatusPipelineConfig<Entity>;  // status transition rules
  approvalPipeline?: ApprovalPipelineConfig;      // draft/submitted approval workflow
}
```

## 3) Build a Controller with `CreateNestedCrudController`

```ts
import { Controller, UseGuards } from '@nestjs/common';
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  PermissionsGuard,
  buildCrudPermissionsFromRegistry,
} from '@nest-util/nest-auth';

const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, {
      resource: 'posts',
    }),
    enableFindMine: true,  // enables GET /post/mine
  }
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

@ApiTags('post')
@Controller('post')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

### Response & Entity Decorators

```ts
import { Message, EntityName } from '@nest-util/nest-crud';

@ApiTags('post')
@Controller('post')
@EntityName('post')           // entity name used by @Audit()/AuditInterceptor when not supplied
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  @Message('Post published successfully')  // custom response message on success
  @Post(':id/publish')
  publish(@Param('id') id: string) { /* ... */ }
}
```

- `@Message(message)` sets the response message metadata (`Message` accepts a string).
- `@EntityName('post')` or `@EntityName({ singular: 'post', plural: 'posts' })` names the resource; the singular form is used when `@Audit()` omits `entity`.

## 4) Available CRUD Endpoints

Generated controller includes:

- `GET /resource` (with `page`, `limit`, `filter[...]`, `cursor`, `includeTotal`)
- `GET /resource/mine` (user-scoped, requires `enableFindMine: true` + authentication)
- `GET /resource/:id`
- `POST /resource`
- `PATCH /resource/:id`
- `DELETE /resource/:id`
- `GET /resource/auditlogs` (if `service.findAuditLogs` exists)
- `POST /resource/:id/status` (if a `statusPipeline` is configured)
- `GET /resource/:id/approval` (if an `approvalPipeline` is configured)
- `POST /resource/:id/approval/approve`
- `POST /resource/:id/approval/reject`
- `POST /resource/:id/approval/request-modification`
- `POST /resource/:id/approval/resubmit`

## 5) Status Pipeline

Enforce a status field with a declared transition graph. Configure on the service:

```ts
super({
  repository,
  statusPipeline: {
    field: 'status',
    initial: 'draft',
    transitions: [
      { from: 'draft', to: ['pending'] },
      { from: 'pending', to: ['approved', 'rejected'] },
      { from: 'rejected', to: ['pending'] },
      { from: 'approved', to: ['published'] },
    ],
  },
});
```

Transitions can also be written as a plain map, and edges may carry a permission and/or an action:

```ts
statusPipeline: {
  field: 'status',
  initial: 'draft',
  transitions: {
    draft: ['pending'],
    pending: ['approved', 'rejected'],
  },
},
// or with a required permission / side-effect action per edge:
// transitions: [
//   { from: 'pending', to: ['approved'], permission: 'posts.approve' },
//   { from: 'approved', to: ['published'], action: async (ctx) => { /* notify */ } },
// ]
```

### Actions

Run side effects when a status transitions. Each edge may define an `action`, and the pipeline may define a global `onTransition` that runs after every transition:

```ts
statusPipeline: {
  field: 'status',
  initial: 'draft',
  transitions: [
    { from: 'draft', to: ['pending'] },
    { from: 'pending', to: ['approved', 'rejected'] },
    {
      from: 'approved',
      to: ['published'],
      action: async ({ id, entity }) => {
        await notifySubscribers(id);
      },
    },
  ],
  onTransition: async ({ id, from, to, user }) => {
    await auditLog.write({ id, from, to, user: user?.id });
  },
},
```

The context is `{ id, entity, from, to, user }`:

- `entity` — the saved entity (the status field already reflects the new value)
- `from` / `to` — the previous and new status values
- `user` — the authenticated user who triggered the transition (undefined when unauthenticated)

Behavior:

- **Create**: the status is auto-set to `initial` (after validation, before `beforeCreate`). Explicit statuses are rejected (400) unless listed in `allowCreateStatuses` (`initial` is always allowed).
- **Update**: a status change must be a registered edge (`from` → `to`); otherwise a `400` with the allowed target statuses is returned. Edges with a `permission` require the caller to hold it (403 via the existing ownership/permission resolver).
- **`POST /:id/status`**: dedicated endpoint mirroring update semantics (404 when no pipeline is configured or the endpoint is disabled). Body: `{ "status": "approved" }`.
- Status validation runs **after** `beforeUpdate` hooks, so hook-driven mutations are also validated.
- **Actions** run **after** the transition is saved (edge `action` first, then global `onTransition`), and are awaited. They never fire for same-status no-ops, missing status fields, or rejected transitions.

Permission gating: grant `posts.changeStatus` (or map the action via `endpointActions` when building permissions) and use `@ApiBearerAuth` + `PermissionsGuard` as in section 3.

## 6) Approval Pipeline

An approval workflow for newly created records. When enabled, every `create` also writes an `approval_statuses` row inside the **same transaction**, starting at `draft` (default) or `submitted` (see `initialStatus`). Reviewers can approve, reject, or request modifications; the creator can then resubmit. The two backing tables (`approval_statuses`, `approval_modification_history`) ship with the library — register them with TypeORM (`TypeOrmModule.forFeature`) and let `synchronize` or a migration create them.

Status flow:

```
draft ──> submitted ────────> approved
   │        │  └────────────> rejected
   │        └─> modification_requested ──> resubmitted ──> approved / rejected
              │                                    │
              └────────────────────────────────────┘
            (modifications may be requested again)
```

Configure on the service:

```ts
super({
  repository,
  approvalPipeline: {
    // enabled defaults to true when the option is provided
    // initialStatus: 'draft' (default) | 'submitted'
    initialStatus: 'draft',
    permissions: {
      submit: 'posts.submit',               // required to move draft -> submitted
      approve: 'posts.approve',             // optional per-action permission
      reject: 'posts.reject',
      requestModification: 'posts.update',
      resubmit: 'posts.update',
    },
    visibleStatuses: ['approved'],         // optional read filter (default: all)
    resubmitCheck: {
      mode: 'all',                         // 'all' (default) | 'any'
      ignoreFields: ['tags'],              // fields exempt from the check
      // customChecker: async ({ modifications, satisfied, entity }) => true,
    },
    hooks: {
      beforeSubmit: {
        handler: async (ctx) => { /* validate before the submit transition */ },
      },
      afterApprove: {
        handler: async (ctx) => { /* notify after approval is saved */ },
        transaction: true,                 // optional; runs inside a transaction
      },
    },
  },
});
```

Behavior:

- **Create**: the record and an approval row (`entity` = table name, `entityId` = stringified PK) are created in one transaction. With the default `initialStatus: 'draft'` the row starts at `draft` (no `requestedBy` yet). With `initialStatus: 'submitted'` it starts at `submitted` and `requestedBy` is set to the creating user, so no explicit submit step is needed. If either write fails, both roll back.
- **`POST /:id/approval/submit`** — moves `draft` → `submitted` and records `requestedBy`. When the record is already in a reviewable/terminal state (e.g. it started as `submitted`), this is a harmless no-op returning the current status. Gated by `permissions.submit` when the transition actually runs.
- **`GET /:id/approval`** — returns `{ approval, history }`, where `approval` is the current status row and `history` is every modification request ever made (newest first).
- **`POST /:id/approval/approve`** / **`reject`** — allowed from `submitted` or `resubmitted`; records `decidedBy` / `decidedAt`. `400` on illegal transitions, `404` when the entity or approval row is missing.
- **`POST /:id/approval/request-modification`** — allowed from `submitted` or `resubmitted`; body `{ modifications: [{ field, currentValue?, wantedValue, note? }], note? }`. Moves the status to `modification_requested`, stores the items on `currentModifications`, and appends an immutable `approval_modification_history` row. `currentValue` is **auto-captured from the live record** when omitted — relation fields are loaded automatically (no `include` configuration needed; nested dot paths like `company.addresses` work too). Each captured value also stores a SHA-256 `currentValueHash` of its canonical JSON form. Circular references in captured objects are sanitized to `'[Circular]'` so the `jsonb` column saves cleanly.
- **`POST /:id/approval/resubmit`** — moves `modification_requested` → `resubmitted`. With `resubmitCheck` configured, the request is rejected with `400 CRUD_APPROVAL_RESUBMIT_NOT_SATISFIED` until the requester has actually changed each requested field (see below).
- **Permissions**: when `permissions.<action>` is set, the caller must hold that permission (403 otherwise). When unset, the action is open to any caller. Ownership rules from `enforceOwnership` are respected for all approval actions.
- **Lifecycle hooks**: `hooks.before<Action>` fires before the transition (with the current approval view); `hooks.after<Action>` fires after the transition is saved (with the new view and `previousStatus`). `requestModification` hooks also receive `modifications` and `note`. Hooks use the same `{ handler, transaction? }` shape as `CrudHooks`, and `transaction: true` wraps the handler in its own transaction. A `submit` that is a no-op (already reviewable) skips hooks. See section 7 for the full hook list and context shapes.
- **Visibility**: when `visibleStatuses` is set, read endpoints (`findAll`, `findMine`, `findAllWithCursor`, `findOne`) only return records whose approval status is in the list. Unset = all records visible regardless of approval state.
- Endpoints 404 when the pipeline is disabled or the endpoint is disabled, mirroring `changeStatus`.

The endpoints map to `CrudEndpoint` values `getApproval | submitApproval | approveApproval | rejectApproval | requestModification | resubmitApproval`. Map them for the permission guard via `endpointActions`:```ts
buildCrudPermissionsFromRegistry(permissionRegistry, {
  resource: 'posts',
  endpointActions: {
    getApproval: 'read',
    submitApproval: 'submit',
    approveApproval: 'approve',
    rejectApproval: 'reject',
    requestModification: 'update',
    resubmitApproval: 'update',
  },
});
```

### Resubmit check (`resubmitCheck`)

`wantedValue` is treated as a suggestion, not a requirement. To stop users from
blindly pressing resubmit, configure `resubmitCheck`: at request time each
modification item's `currentValue` is hashed (SHA-256 of its canonical JSON), and
at resubmit time the live field value is hashed the same way. A matching hash
means the field was **not touched**, and the resubmit is rejected with
`400 CRUD_APPROVAL_RESUBMIT_NOT_SATISFIED` listing the unchanged fields.

```ts
approvalPipeline: {
  resubmitCheck: {
    mode: 'all',            // default 'all': every requested field must change; 'any': at least one
    ignoreFields: ['tags'], // advisory-only fields that don't gate resubmission
    // Full override — return false to block:
    customChecker: async ({ modifications, satisfied, entity }) => {
      return satisfied.every((s) => s.satisfied);
    },
  },
}
```

Notes:

- Relation fields work without configuring `include` — they are loaded
  automatically for both capture and check.
- Key order, `undefined` vs `null`, and Date serialization are normalized by the
  canonical hashing, so jsonb round-trips don't cause false positives. Collection
  fields are compared as unordered sets — reordering rows alone doesn't count as
  a change.
- Rows stored before this feature (no hash) fall back to deep equality against
  the stored `currentValue`; items with neither value nor hash are treated as
  satisfied.
- Editing a field back to its exact original value reads as "unchanged" — only
  current-vs-snapshot is known.

## 7) Lifecycle Hooks

Configure hooks in your service for before/after actions:

```ts
super({
  repository,
  hooks: {
    beforeCreate: {
      handler: async (ctx) => { /* validate, transform */ },
      transaction: true,  // runs inside a DB transaction
    },
    afterCreate: {
      handler: async (ctx) => { /* send events, notify */ },
    },
  },
  transactionConfig: {
    isolationLevel: 'READ COMMITTED',
  },
});
```

Available hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeRemove`, `afterRemove`, `beforeFindOne`, `afterFindOne`.

### Approval Lifecycle Hooks

The approval pipeline (section 6) exposes the same hook shape for its transitions, nested under `approvalPipeline.hooks`:

```ts
approvalPipeline: {
  hooks: {
    beforeSubmit: { handler: async (ctx) => {} },
    afterSubmit: { handler: async (ctx) => {}, transaction: true },
    beforeApprove: { handler: async (ctx) => {} },
    afterApprove: { handler: async (ctx) => {} },
    beforeReject: { handler: async (ctx) => {} },
    afterReject: { handler: async (ctx) => {} },
    beforeRequestModification: { handler: async (ctx) => {} },
    afterRequestModification: { handler: async (ctx) => {} },
    beforeResubmit: { handler: async (ctx) => {} },
    afterResubmit: { handler: async (ctx) => {} },
  },
}
```

Each `before<Action>` context carries `{ id, user?, approval }`, where `approval` is the current `ApprovalStatusView`. Each `after<Action>` context adds `previousStatus` and carries the freshly saved `approval` view. `requestModification` hooks additionally receive `modifications` and `note`.

## 8) Cursor Pagination

Pass `?cursor=<opaque>` to `GET /` for cursor-based pagination:

```bash
# First page
GET /posts?limit=10

# Next page
GET /posts?cursor=eyJpZCI6MTB9&limit=10

# With total count
GET /posts?cursor=eyJpZCI6MTB9&limit=10&includeTotal=true
```

Integer PKs use `id > cursor`. UUID PKs use composite `(createdAt, id)` cursors.

### Cursor Helpers

Low-level cursor utilities are exported for custom pagination logic:

```ts
import {
  base64UrlEncode,
  base64UrlDecode,
  decodeCursor,
  applyCursorFilter,
  buildNextCursor,
  detectCursorStrategy,
} from '@nest-util/nest-crud';

// Encode/decode opaque cursors (base64url JSON)
const cursor = base64UrlEncode({ id: 42, createdAt: '2024-01-01T00:00:00Z' });
const payload = base64UrlDecode(cursor);

// Decode against a strategy ({ type: 'integer' } | { type: 'uuid', timestampColumn })
const decoded = decodeCursor(cursor, { type: 'uuid', timestampColumn: 'createdAt' });

// Mutate a TypeORM SelectQueryBuilder with the cursor filter
applyCursorFilter(qb, decoded, strategy, 'DESC');

// Build the next cursor from the last page of results
const next = buildNextCursor(results, strategy);

// Auto-detect integer vs uuid strategy from a repository's PK metadata
const strategy = detectCursorStrategy(repo);
```

Strategy types:

```ts
type CursorStrategy =
  | { type: 'integer' }
  | { type: 'uuid'; timestampColumn: string };
```

## 9) findMine (User-Scoped Records)

Simple column match:

```ts
super({
  repository,
  userOwnershipField: 'authorId',
});
```

Custom query:

```ts
super({
  repository,
  findMineQuery: (qb, userId) => {
    qb.where('e.authorId = :userId', { userId })
      .orWhere('e.id IN (SELECT postId FROM post_collaborators WHERE userId = :userId)', { userId });
  },
});
```

### Ownership enforcement

`findMine` adds a user-scoped *list* endpoint. To also scope `findOne`, `update`,
and `remove` to the authenticated user, add `enforceOwnership: true`. Non-owned
records return 404 (no existence leak); unauthenticated requests return 403
(fail-closed).

```ts
super({
  repository,
  userOwnershipField: 'authorId',
  enforceOwnership: true,
  ownershipBypassPermissions: ['admin.access'],
  // ownershipBypass: (user) => user.email?.endsWith('@example.com'),
  // superAdminPermission: 'admin.access',
});
```

This is opt-in and defaults to `false`.

## 10) Audit Logging

Two complementary audit mechanisms are built in: **event-based** (real-time streams) and **DB-backed** (persistent audit trail).

### Event-Based Audit Events

`AuditEventModule.forRoot()` subscribes to all events emitted by `@nestjs/event-emitter` and dispatches matching ones to your handlers:

```ts
import { Module } from '@nestjs/common';
import { AuditEventModule, ConsoleHandler } from '@nest-util/nest-crud';

@Module({
  imports: [
    AuditEventModule.forRoot({
      handlers: [new ConsoleHandler()], // built-in: colorized stdout logging
      include: ['crud.*'],             // glob patterns to forward (default: ['*'])
      exclude: [],                     // glob patterns to drop
    }),
  ],
})
export class AppModule {}
```

A handler implements `AuditEventHandler`:

```ts
import { AuditEvent, AuditEventHandler } from '@nest-util/nest-crud';

export class PostHogHandler implements AuditEventHandler {
  handle(event: AuditEvent): void | Promise<void> {
    // event.action, event.entity, event.entityId, event.userId,
    // event.ip, event.userAgent, event.tenantId, event.timestamp, event.metadata
  }
}
```

`AuditEvent` shape:

```ts
interface AuditEvent {
  action: string;            // dot-separated, e.g. 'crud.post.create.success'
  entity: string;            // 'post', 'user', ...
  entityId?: string | number;
  userId?: string | number;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
```

### `@Audit()` Decorator + `AuditInterceptor`

The controller factory already decorates its endpoints, but you can audit any custom endpoint:

```ts
import { Audit } from '@nest-util/nest-crud';

@Audit({ action: 'publish', entity: 'post' })
@Post(':id/publish')
publish(@Param('id') id: string) { /* ... */ }
```

`AuditInterceptor` records the action via `AuditService` (if the entity is in TypeORM) and emits:

- `crud.<entity>.<action>.success` on success
- `crud.<entity>.<action>.error` on failure

Entity name resolves from `@Audit()`, the controller's `@EntityName()`, or the repository metadata (falls back to `'Resource'`).

### DB-Backed Audit Trail

Register `NestCrudModule` to get a persistent `audit_logs` table and the `AuditService`:

```ts
import { NestCrudModule } from '@nest-util/nest-crud';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]), // ensure the entity is registered
    NestCrudModule,                             // provides AuditService
  ],
})
export class AppModule {}
```

`AuditLogEntity` columns: `id`, `tenantId`, `action`, `entity`, `entityId`, `userId`, `metadata` (jsonb), `ip`, `userAgent`, `createdAt`.

Use the service:

```ts
import { Inject } from '@nestjs/common';
import { AuditService } from '@nest-util/nest-crud';

export class MyService {
  constructor(private readonly auditService: AuditService) {}

  async track() {
    // log(action, entity, entityId, options)
    await this.auditService.logEntityAction('export.run', 'report', '42', {
      userId: 'u1',
      metadata: { rows: 100 },
    });

    // page-based queries
    const { data, meta } = await this.auditService.findAll({ entity: 'report', page: 1, limit: 20 });

    // cursor-based queries
    const { data, meta } = await this.auditService.findAllWithCursor({ limit: 20, includeTotal: true });
  }
}
```

`CreateAuditLogInput` fields: `action`, `tenantId?`, `entity?`, `entityId?`, `userId?`, `metadata?`, `ip?`, `userAgent?`.

## 11) Testing Factory

Generate complete test suites for your CRUD service and controller with zero boilerplate.

### Service Tests

```ts
import { crudServiceTests } from '@nest-util/nest-crud/testing';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

describe('PostService', () => {
  crudServiceTests({
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    allowedFilters: ['title'],
    userOwnershipField: 'authorId',
    test: {
      createPayload: { title: 'Hello', content: 'World' },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

This generates ~20 tests covering `findAll`, `findOne`, `create`, `update`, `remove`, `findMine`, `findAllWithCursor`, `findAuditLogs`, and disabled endpoints.

### Controller Tests

```ts
import { crudControllerTests } from '@nest-util/nest-crud/testing';
import { CreateNestedCrudController } from '@nest-util/nest-crud';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

const PostControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post,
  { enableFindMine: true }
);

describe('PostController', () => {
  crudControllerTests({
    controllerFactory: () => PostControllerBase,
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    permissions: {
      findAll: 'posts.read',
      findOne: 'posts.read',
      create: 'posts.create',
      update: 'posts.update',
      remove: 'posts.delete',
      findAuditLogs: 'posts.audit',
      findMine: 'posts.read',
    },
    test: {
      createPayload: { title: 'Hello', content: 'World' },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

This generates ~15 tests covering all endpoints, disabled endpoint guards, and permission metadata.

### Available Config Options

| Option | Description |
|--------|-------------|
| `entity` | TypeORM entity class |
| `serviceClass` | Your service class |
| `createDto` / `updateDto` | DTO classes |
| `allowedFilters` | Fields available for filtering |
| `userOwnershipField` | Column for `findMine` ownership |
| `findMineQuery` | Custom query builder for complex ownership |
| `disabledEndpoints` | Endpoints to test as disabled |
| `hooks` | Hook configs to test |
| `toResponseDto` | Response transformer |
| `test.createPayload` | Sample create DTO |
| `test.updatePayload` | Sample update DTO |
| `test.mockEntity` | Custom mock entity data |
| `test.mockRepoOverrides` | Override mock repository methods |
| `authOptions` | Auth options passed to the controller test module |

### Mock Utilities

```ts
import { createMockRepository, createMockQb, createDefaultMockEntity } from '@nest-util/nest-crud/testing';

// Create a mock TypeORM repository
const repo = createMockRepository(Post);

// Create a mock query builder
const qb = createMockQb();

// Auto-generate mock entity from TypeORM metadata
const mock = createDefaultMockEntity(Post);
```

## 12) Global Response and DB Error Handling

Add `ResponseInterceptor` as a global interceptor for a consistent response shape:

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from '@nest-util/nest-crud';

@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: ResponseInterceptor }],
})
export class AppModule {}
```

For database errors (including duplicate keys), register `LocalizationModule`
from `@nest-util/nest-error`. Its global `LocalizedExceptionFilter` maps TypeORM
unique violations to `DB_DUPLICATE_ENTRY` with no SQL leaked. See
[libs/nest-error/README.md](./../../libs/nest-error/README.md).

```ts
import { LocalizationModule } from '@nest-util/nest-error';

@Module({
  imports: [LocalizationModule.forRoot({ defaultLang: 'en', supportedLangs: ['en'] })],
})
export class AppModule {}
```

## 13) Filtering and Pagination Notes

- Filtering uses `filter[field_operator]=value` format.
- Supported operators: `eq`, `ne`, `cont`, `notcont`, `starts`, `ends`, `gte`, `lte`, `gt`, `lt`, `in`, `nin`, `isnull`.
- Express query parser should be `extended` for deep object query parsing.

## 14) Help Notes

- Use `disabledEndpoints` in service options to hide generated routes without rewriting controllers.
- `relations` option lets you resolve `propertyId` payload fields into related entities.
- If `findAuditLogs` is not implemented in service, `/auditlogs` returns not found by design.
- `POST /:id/status` returns 404 unless a `statusPipeline` is configured on the service and the endpoint is not disabled.
- `findMine` returns 404 unless `enableFindMine: true` is set on the controller and `userOwnershipField`/`findMineQuery` is configured on the service.
