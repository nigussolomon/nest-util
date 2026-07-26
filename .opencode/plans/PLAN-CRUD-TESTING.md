# Plan: CRUD Testing Factory

## Goal

Provide out-of-the-box test suites for `NestCrudService` and `CreateNestedCrudController` consumers. Consumer passes the same config they use in production (entity, DTOs, options), and the factory auto-generates a full test suite covering all CRUD operations.

## Consumer API

```typescript
import { crudServiceTests, crudControllerTests } from '@nest-util/nest-crud/testing';

describe('PostService', () => {
  crudServiceTests({
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    allowedFilters: ['title', 'published'],
    userOwnershipField: 'authorId',
    test: {
      createPayload: { title: 'Hello', content: 'World', published: true },
      updatePayload: { title: 'Updated' },
    },
  });

  // Consumer adds custom tests here
  it('should handle custom business logic', async () => { ... });
});

describe('PostController', () => {
  crudControllerTests({
    controllerFactory: () => CreateNestedCrudController(CreatePostDto, UpdatePostDto, Post, { enableFindMine: true }),
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    responseDto: PostResponseDto,
    test: {
      createPayload: { title: 'Hello', content: 'World', published: true },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

## Files to Create

All under `libs/nest-crud/src/lib/testing/`:

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `testing.interface.ts` | Config types |
| `mock-repository.ts` | Auto-mock repository + QueryBuilder |
| `crud-service.test-suites.ts` | Service-level test suites |
| `crud-controller.test-suites.ts` | Controller-level test suites |

Plus:
- `libs/nest-crud/src/index.ts` — add `export * from './lib/testing'`
- `libs/nest-crud/src/lib/testing/__tests__/crud-service.test-suites.spec.ts` — factory's own tests
- `libs/nest-crud/src/lib/testing/__tests__/crud-controller.test-suites.spec.ts` — factory's own tests
- `docs/nest-crud/README.md` — add testing section
- `.opencode/skills/nest-util/SKILL.md` — add testing docs

## Implementation Details

### 1. `testing.interface.ts`

```typescript
import { Type } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { CrudServiceOptions } from '../services/nest-crud.service';
import { CrudEndpoint } from '../interfaces/crud.interface';

export interface CrudTestConfig<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto,
> {
  // Required
  entity: Type<TEntity>;
  serviceClass: Type<any>;

  // Optional — auto-generate from entity if omitted
  createDto?: Type<TCreateDto>;
  updateDto?: Type<TUpdateDto>;
  responseDto?: Type<TResponseDto>;

  // CrudServiceOptions subset (without repository — factory creates mock)
  allowedFilters?: readonly (keyof TEntity)[];
  allowedSortFields?: readonly (keyof TEntity)[];
  include?: readonly string[];
  userOwnershipField?: keyof TEntity;
  findMineQuery?: (qb: any, userId: string | number) => void;
  disabledEndpoints?: readonly CrudEndpoint[];
  hooks?: CrudServiceOptions<TEntity, TResponseDto>['hooks'];
  toResponseDto?: (entity: TEntity | TEntity[]) => TResponseDto | TResponseDto[];
  relations?: CrudServiceOptions<TEntity, TResponseDto>['relations'];

  // Test data
  test: {
    createPayload: Partial<TCreateDto>;
    updatePayload: Partial<TUpdateDto>;
    /** Override auto-generated mock entity (merged with defaults) */
    mockEntity?: Partial<TEntity>;
    /** Override auto-generated mock entities for list tests */
    mockEntities?: TEntity[];
    /** Custom mock repository methods */
    mockRepoOverrides?: Partial<jest.Mocked<Repository<TEntity>>>;
  };
}

export interface CrudControllerTestConfig<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto,
> extends Omit<CrudTestConfig<TEntity, TCreateDto, TUpdateDto, TResponseDto>, 'serviceClass'> {
  /** Factory that returns the controller base class */
  controllerFactory: () => Type<any>;
  /** Service class for the controller — factory creates mock */
  serviceClass: Type<any>;
}

export interface CrudTestContext {
  /** The TestingModule — use forDI resolution if needed */
  module: any; // TestingModule
  /** The mock repository — override methods for specific tests */
  repository: jest.Mocked<any>;
  /** Create a fresh QueryBuilder mock (chainable, all methods return this) */
  createMockQb: () => MockQueryBuilder;
}

export interface MockQueryBuilder {
  where: jest.Mock;
  andWhere: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  leftJoin: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  getMany: jest.Mock;
  getOne: jest.Mock;
  getCount: jest.Mock;
  getRawOne: jest.Mock;
}
```

### 2. `mock-repository.ts`

**`autoMockEntity(entity)`**: Reads `EntityMetadata` from the entity class via `getMetadata()` and generates a mock object:
- Integer PKs → `1`
- UUID PKs → `'00000000-0000-0000-0000-000000000001'`
- String columns → `'mock_<columnName>'`
- Number columns → `0`
- Boolean columns → `true`
- Date columns → `new Date('2024-01-01T00:00:00.000Z')`
- JSON/JSONB columns → `{}`

**`createMockQb()`**: Returns a `MockQueryBuilder` where every method returns `this` (chainable). Terminal methods return sensible defaults:
- `getManyAndCount` → `[[], 0]`
- `getMany` → `[]`
- `getOne` → `null`
- `getCount` → `0`
- `getRawOne` → `{}`

**`createMockRepository(entity, overrides?)`**: Builds a complete mock repository:
```typescript
{
  createQueryBuilder: jest.fn().mockReturnValue(createMockQb()),
  findOne: jest.fn().mockResolvedValue(mockEntity),
  findOneBy: jest.fn().mockResolvedValue(mockEntity),
  merge: jest.fn((e, p) => Object.assign(e, p)),
  save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  find: jest.fn().mockResolvedValue([mockEntity]),
  metadata: {
    name: entity.name,
    primaryColumns: [{ propertyPath: 'id', type: () => Number }],
  },
  manager: {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(createMockQb()),
    }),
    connection: {
      createQueryRunner: jest.fn().mockReturnValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      }),
    },
  },
  ...overrides,
}
```

### 3. `crud-service.test-suites.ts`

**`crudServiceTests(config)`** — runs inside a `describe` block. Consumer calls this in their test file:

```typescript
describe('PostService', () => {
  const ctx = crudServiceTests({ ... });
  // ctx is CrudTestContext — available for consumer's custom tests
});
```

**Auto-generated test suites:**

| Suite | Tests |
|-------|-------|
| `findAll` | returns paginated data, applies filters (calls `andWhere`), joins include relations (`leftJoinAndSelect`), applies orderBy, returns empty data |
| `findOne` | returns entity, throws NotFoundException when not found, passes include as relations |
| `create` | saves and returns entity, calls `save` with payload |
| `update` | merges and saves existing entity, throws NotFoundException when missing |
| `remove` | deletes entity and returns true, throws NotFoundException when missing |
| `findMine` | filters by ownership field, throws BadRequestException when not configured (skipped if userOwnershipField set), applies filters, joins relations |
| `findAllWithCursor` | returns cursor result, handles hasMore (limit+1), builds nextCursor, includes total when `includeTotal: true` (skipped if disabledEndpoints includes) |
| `disabledEndpoints` | throws NotFoundException for each disabled endpoint |
| `findAuditLogs` | queries audit logs with pagination |

**Total: ~20-25 auto-generated tests** (depends on config options enabled).

Each test creates a fresh `createMockQb()` instance, assigns it to `repository.createQueryBuilder.mockReturnValue(qb)`, then runs the service method and asserts on both the service return value and the QueryBuilder mock calls.

### 4. `crud-controller.test-suites.ts`

**`crudControllerTests(config)`** — runs inside a `describe` block.

**Auto-generated test suites:**

| Suite | Tests |
|-------|-------|
| `findAll` | calls `service.findAll` with query params, handles pagination, handles complex filters |
| `findOne` | calls `service.findOne` with correct id |
| `create` | calls `service.create` with dto |
| `update` | calls `service.update` with id and dto |
| `remove` | calls `service.remove` |
| `findMine` | calls `service.findMine` with user id (if enabled) |
| `disabledEndpoints` | throws NotFoundException for disabled endpoints |
| `permissions` | verifies auth permission metadata (if permissions provided) |

**Total: ~12-15 auto-generated tests.**

Controller tests use a mock `CrudInterface` service (all methods are `jest.fn()`), NOT the mock repository. The controller factory is called to create the controller class, which is then instantiated with the mock service.

### 5. Test Module Setup

For service tests:
```typescript
const module = await Test.createTestingModule({
  providers: [
    {
      provide: config.serviceClass,
      useFactory: (repo) => new config.serviceClass({ repository: repo, ...serviceOptions }),
      inject: [{ token: getRepositoryToken(config.entity), optional: true }],
    },
  ],
}).compile();
```

Actually simpler — since we create the mock repo ourselves, just instantiate directly:
```typescript
const repository = createMockRepository(config.entity, config.test.mockRepoOverrides);
const service = new config.serviceClass({
  repository,
  allowedFilters: config.allowedFilters,
  // ... all options except repository
});
```

For controller tests:
```typescript
const ControllerBase = config.controllerFactory();
const mockService = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), ... };

class TestController extends ControllerBase {
  constructor() { super(mockService); }
}

const module = await Test.createTestingModule({
  controllers: [TestController],
}).compile();
const controller = module.get(TestController);
```

## Demo-API Validation

Use the factory to generate real tests for the demo-api's Post and Comment resources. This proves the factory works end-to-end for consumers.

### `apps/demo-api/src/app/post/post.service.spec.ts`

```typescript
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
    allowedFilters: [],
    userOwnershipField: 'authorId',
    test: {
      createPayload: { title: 'Hello', content: 'World' },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

### `apps/demo-api/src/app/post/post.controller.spec.ts`

```typescript
import { crudControllerTests } from '@nest-util/nest-crud/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { CreateNestedCrudController } from '@nest-util/nest-crud';

describe('PostController', () => {
  crudControllerTests({
    controllerFactory: () =>
      CreateNestedCrudController(CreatePostDto, UpdatePostDto, Post, {
        enableFindMine: true,
      }),
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    test: {
      createPayload: { title: 'Hello', content: 'World' },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

### `apps/demo-api/src/app/comment/comment.service.spec.ts`

```typescript
import { crudServiceTests } from '@nest-util/nest-crud/testing';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';

describe('CommentService', () => {
  crudServiceTests({
    serviceClass: CommentService,
    entity: Comment,
    createDto: CreateCommentDto,
    updateDto: UpdateCommentDto,
    allowedFilters: [],
    test: {
      createPayload: { text: 'Nice post' },
      updatePayload: { text: 'Updated comment' },
    },
  });
});
```

### `apps/demo-api/src/app/comment/comment.controller.spec.ts`

```typescript
import { crudControllerTests } from '@nest-util/nest-crud/testing';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';
import { CreateNestedCrudController } from '@nest-util/nest-crud';

describe('CommentController', () => {
  crudControllerTests({
    controllerFactory: () =>
      CreateNestedCrudController(CreateCommentDto, UpdateCommentDto, Comment),
    serviceClass: CommentService,
    entity: Comment,
    createDto: CreateCommentDto,
    updateDto: UpdateCommentDto,
    test: {
      createPayload: { text: 'Nice post' },
      updatePayload: { text: 'Updated comment' },
    },
  });
});
```

## Implementation Order

1. `testing.interface.ts` — all types
2. `mock-repository.ts` — autoMockEntity, createMockQb, createMockRepository
3. `crud-service.test-suites.ts` — all service test suites
4. `crud-controller.test-suites.ts` — all controller test suites
5. `index.ts` — barrel export
6. Update `libs/nest-crud/src/index.ts` — add testing export
7. Write factory's own tests (`__tests__/` directory)
8. Create demo-api test files (Post service + controller, Comment service + controller)
9. Run demo-api tests to validate factory works end-to-end
10. Update `docs/nest-crud/README.md` — add testing section
11. Update `.opencode/skills/nest-util/SKILL.md` — add testing docs
12. Run full validation (lint, typecheck, test across all projects)

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `libs/nest-crud/src/lib/testing/index.ts` | Barrel export |
| `libs/nest-crud/src/lib/testing/testing.interface.ts` | Config types |
| `libs/nest-crud/src/lib/testing/mock-repository.ts` | Auto-mock repository + QueryBuilder |
| `libs/nest-crud/src/lib/testing/crud-service.test-suites.ts` | Service-level test suites |
| `libs/nest-crud/src/lib/testing/crud-controller.test-suites.ts` | Controller-level test suites |
| `libs/nest-crud/src/lib/testing/__tests__/crud-service.test-suites.spec.ts` | Factory's own tests |
| `libs/nest-crud/src/lib/testing/__tests__/crud-controller.test-suites.spec.ts` | Factory's own tests |
| `apps/demo-api/src/app/post/post.service.spec.ts` | Post service tests using factory |
| `apps/demo-api/src/app/post/post.controller.spec.ts` | Post controller tests using factory |
| `apps/demo-api/src/app/comment/comment.service.spec.ts` | Comment service tests using factory |
| `apps/demo-api/src/app/comment/comment.controller.spec.ts` | Comment controller tests using factory |

### Modified Files

| File | Change |
|------|--------|
| `libs/nest-crud/src/index.ts` | Add `export * from './lib/testing'` |
| `docs/nest-crud/README.md` | Add "Testing" section with examples |
| `.opencode/skills/nest-util/SKILL.md` | Add testing factory documentation |
