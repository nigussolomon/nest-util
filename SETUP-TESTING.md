# Unit Testing with @nest-util/nest-crud

## Installation

The testing utilities are included in `@nest-util/nest-crud`. You also need Jest and ts-jest:

```bash
npm install --save-dev jest ts-jest @types/jest
```

## Imports

```typescript
import {
  crudServiceTests,
  crudControllerTests,
  createMockRepository,
  createMockQb,
  CrudTestConfig,
  CrudControllerTestConfig,
} from '@nest-util/nest-crud/testing';
```

## Service Tests

### Minimal Setup

```typescript
// assignment.service.spec.ts
import { CrudTestConfig } from '@nest-util/nest-crud/testing';
import { crudServiceTests } from '@nest-util/nest-crud/testing';
import { AssignmentService } from './assignment.service';
import { Assignment } from '@org/db';

const config: CrudTestConfig<Assignment, any, any, any> = {
  entity: Assignment,
  serviceClass: AssignmentService,
  test: {
    createPayload: { orderId: '1', driverId: '1', carId: '1' },
    updatePayload: { driverId: '2' },
  },
};

crudServiceTests(config);
```

This runs ~15 standard CRUD tests automatically: findAll, findOne, create, update, remove, findMine, findAllWithCursor, findAuditLogs, and disabledEndpoints.

### Full Setup with Relations and Hooks

```typescript
import { CrudTestConfig } from '@nest-util/nest-crud/testing';
import { crudServiceTests } from '@nest-util/nest-crud/testing';
import { AssignmentService } from './assignment.service';
import { Assignment } from '@org/db';

const config: CrudTestConfig<Assignment, any, any, any> = {
  entity: Assignment,
  serviceClass: AssignmentService,
  allowedFilters: ['assignedBy', 'order', 'car', 'driver'],
  allowedSortFields: ['assignedAt', 'createdAt'],
  include: ['order', 'driver', 'car'],
  relations: [
    { property: 'order', repo: null as any, idField: 'orderId' },
    { property: 'driver', repo: null as any, idField: 'driverId' },
    { property: 'car', repo: null as any, idField: 'carId' },
  ],
  toResponseDto: (entity) => {
    if (Array.isArray(entity)) {
      return entity.map((a) => ({ id: a.id, order: a.order }));
    }
    return { id: entity.id, order: entity.order };
  },
  test: {
    createPayload: { orderId: '1', driverId: '1', carId: '1', assignedBy: 'admin' },
    updatePayload: { driverId: '2' },
    mockEntity: { id: '1', assignedBy: 'admin' },
  },
};

const ctx = crudServiceTests(config);
```

### Adding Custom Tests

`crudServiceTests` returns a context with access to the mocked repository and module:

```typescript
const ctx = crudServiceTests(config);

describe('AssignmentService - custom', () => {
  it('should reject duplicate assignments', async () => {
    ctx.repository.count.mockResolvedValue(1);

    await expect(
      ctx.module.get(AssignmentService).create({ orderId: '1' } as any)
    ).rejects.toThrow('Order already has an assignment');
  });
});
```

## Controller Tests

```typescript
// assignment.controller.spec.ts
import { CrudControllerTestConfig } from '@nest-util/nest-crud/testing';
import { crudControllerTests } from '@nest-util/nest-crud/testing';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { Assignment } from '@org/db';

const config: CrudControllerTestConfig<Assignment, any, any, any> = {
  entity: Assignment,
  serviceClass: AssignmentService,
  controllerFactory: () => AssignmentController,
  allowedFilters: ['assignedBy'],
  permissions: {
    create: 'assignment:create',
    update: 'assignment:update',
    remove: 'assignment:delete',
  },
  test: {
    createPayload: { orderId: '1', driverId: '1' },
    updatePayload: { driverId: '2' },
  },
};

crudControllerTests(config);
```

## What Gets Tested Automatically

### Service Tests

| Test | What it verifies |
|------|-----------------|
| findAll | Pagination, filters, orderBy, leftJoinAndSelect for includes, empty results |
| findOne | Returns entity, throws NotFoundException on miss |
| create | Saves and returns entity |
| update | Merges, saves, returns updated entity, NotFoundException |
| remove | Deletes and returns true, NotFoundException |
| findMine | Filters by ownership field, BadRequestException if not configured |
| findAllWithCursor | Cursor pagination, hasMore detection, includeTotal |
| findAuditLogs | Queries with pagination |
| disabledEndpoints | Blocks disabled endpoints |

### Controller Tests

| Test | What it verifies |
|------|-----------------|
| findAll | Passes query params to service |
| findOne | Passes id to service |
| create | Passes dto to service |
| update | Passes id and dto to service |
| remove | Passes id to service |
| findMine | Passes user id and query to service |
| disabledEndpoints | Throws NotFoundException for disabled endpoints |
| permissions | Attaches auth permission metadata |
| findAuditLogs | Passes query params to service |

## Mock Utilities

### createMockRepository

Creates a fully mocked TypeORM repository with sensible defaults:

```typescript
import { createMockRepository } from '@nest-util/nest-crud/testing';

const repo = createMockRepository(MyEntity);

// Override specific methods
repo.count.mockResolvedValue(0);
repo.find.mockResolvedValue([]);
```

### createMockQb

Creates a mocked QueryBuilder with chainable methods:

```typescript
import { createMockQb } from '@nest-util/nest-crud/testing';

const qb = createMockQb();
qb.getManyAndCount.mockResolvedValue([[entity1, entity2], 2]);
repo.createQueryBuilder.mockReturnValue(qb as any);
```

## Config Reference

```typescript
interface CrudTestConfig<TEntity, TCreateDto, TUpdateDto, TResponseDto> {
  // Required
  entity: Type<TEntity>;
  serviceClass: Type<any>;

  // Optional - mirrors your NestCrudService options
  allowedFilters?: readonly (keyof TEntity)[];
  allowedSortFields?: readonly (keyof TEntity)[];
  include?: readonly string[];
  userOwnershipField?: keyof TEntity;
  findMineQuery?: (qb, userId) => void;
  disabledEndpoints?: CrudEndpoint[];
  hooks?: CrudHooks;
  toResponseDto?: (entity) => dto;
  relations?: Array<{ property; repo; idField? }>;

  // Test configuration
  test: {
    createPayload: Partial<TCreateDto>;   // Required
    updatePayload: Partial<TUpdateDto>;   // Required
    mockEntity?: Partial<TEntity>;        // Override auto-generated defaults
    mockEntities?: TEntity[];             // For list endpoints
    mockRepoOverrides?: Partial<jest.Mocked<Repository<TEntity>>>;
  };
}
```

## Auto-Generated Mock Entities

`createDefaultMockEntity` inspects your entity class via TypeORM metadata and generates defaults:

| Column Type | Default Value |
|-------------|---------------|
| Primary (uuid) | `'00000000-0000-0000-0000-000000000001'` |
| Primary (number) | `1` |
| String/varchar/text | `'mock_<columnName>'` |
| Number/int/integer | `0` |
| Boolean | `true` |
| Date/timestamp | `new Date('2024-01-01T00:00:00.000Z')` |
| JSON/JSONB | `{}` |
| Other | `null` |

Override any field with `mockEntity`:

```typescript
test: {
  mockEntity: { id: 'custom-id', name: 'Custom Name' },
}
```
