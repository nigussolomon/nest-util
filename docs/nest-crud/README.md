# nest-crud Setup Guide

This guide reflects the implementation in `libs/nest-crud`.

## 1) Install

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^1.0.2 @nest-util/nest-auth@^1.0.2 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
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

## 8) Testing Factory

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

## 9) Global Response and DB Error Handling

Add these in bootstrap:

- `ResponseInterceptor` as global interceptor for consistent response shape.
- `TypeOrmExceptionFilter` as global filter for DB errors (including duplicate keys).

## 10) Filtering and Pagination Notes

- Filtering uses `filter[field_operator]=value` format.
- Supported operators: `eq`, `ne`, `cont`, `notcont`, `starts`, `ends`, `gte`, `lte`, `gt`, `lt`, `in`, `nin`, `isnull`.
- Express query parser should be `extended` for deep object query parsing.

## 11) Help Notes

- Use `disabledEndpoints` in service options to hide generated routes without rewriting controllers.
- `relations` option lets you resolve `propertyId` payload fields into related entities.
- If `findAuditLogs` is not implemented in service, `/auditlogs` returns not found by design.
- `findMine` returns 404 unless `enableFindMine: true` is set on the controller and `userOwnershipField`/`findMineQuery` is configured on the service.
