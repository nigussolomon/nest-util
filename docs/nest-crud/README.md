# nest-crud Setup Guide

This guide reflects the implementation in `libs/nest-crud`.

## 1) Install

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^1.1.3 @nest-util/nest-auth@^1.4.0 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
```

`@nest-util/nest-crud` includes audit logging, lifecycle hooks, cursor pagination, findMine, and a testing factory — all built-in.

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
  userOwnershipField?: keyof Entity;        // enables findMine
  findMineQuery?: (qb, userId) => void;     // custom findMine query
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

## 5) Lifecycle Hooks

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

## 6) Cursor Pagination

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

## 7) findMine (User-Scoped Records)

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

## 8) Audit Logging

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

## 9) Testing Factory

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

## 10) Global Response and DB Error Handling

Add these in bootstrap:

- `ResponseInterceptor` as global interceptor for consistent response shape.
- `TypeOrmExceptionFilter` as global filter for DB errors (including duplicate keys).

## 11) Filtering and Pagination Notes

- Filtering uses `filter[field_operator]=value` format.
- Supported operators: `eq`, `ne`, `cont`, `notcont`, `starts`, `ends`, `gte`, `lte`, `gt`, `lt`, `in`, `nin`, `isnull`.
- Express query parser should be `extended` for deep object query parsing.

## 12) Help Notes

- Use `disabledEndpoints` in service options to hide generated routes without rewriting controllers.
- `relations` option lets you resolve `propertyId` payload fields into related entities.
- If `findAuditLogs` is not implemented in service, `/auditlogs` returns not found by design.
- `findMine` returns 404 unless `enableFindMine: true` is set on the controller and `userOwnershipField`/`findMineQuery` is configured on the service.
