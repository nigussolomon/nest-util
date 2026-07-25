# PLAN: Before/After Transaction Hooks

## Overview

Add configurable before/after action hooks to `NestCrudService` with transaction control, allowing users to pass any function to execute before or after CRUD operations with configurable isolation levels.

## Design Goals

1. **User-supplied functions:** Pass any async/sync function to run before/after CRUD operations
2. **Transaction control:** Flag each hook as `transaction` (rolls back on failure) or `standalone` (independent)
3. **Configurable isolation:** Support PostgreSQL isolation levels (READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
4. **Backward compatible:** No changes to existing API - hooks are optional
5. **Composable:** Mix multiple hooks per operation

## API Design

### Hook Function Signature

```typescript
type CrudHook<TContext = any> = (context: TContext) => Promise<any> | any;
```

### Hook Configuration

```typescript
interface CrudHookConfig<TContext = any> {
  handler: CrudHook<TContext>;
  transaction?: boolean; // Default: false
}
```

### Hook Context Types

```typescript
// Create hooks
interface BeforeCreateContext<TEntity, TCreateDto> {
  payload: TCreateDto;
  entity?: TEntity;
}

interface AfterCreateContext<TEntity, TCreateDto> {
  entity: TEntity;
  payload: TCreateDto;
}

// Update hooks
interface BeforeUpdateContext<TEntity, TUpdateDto> {
  payload: TUpdateDto;
  entity: TEntity;
  id: number;
}

interface AfterUpdateContext<TEntity, TUpdateDto> {
  entity: TEntity;
  payload: TUpdateDto;
  id: number;
}

// Remove hooks
interface BeforeRemoveContext<TEntity> {
  entity: TEntity;
  id: number;
}

interface AfterRemoveContext {
  id: number;
  deleted: boolean;
}

// Find hooks (optional)
interface BeforeFindOneContext {
  id: number;
}

interface AfterFindOneContext<TEntity> {
  entity: TEntity;
  id: number;
}
```

### Full Hooks Interface

```typescript
interface CrudHooks<TEntity, TCreateDto, TUpdateDto> {
  // Create hooks
  beforeCreate?: CrudHookConfig<BeforeCreateContext<TEntity, TCreateDto>>;
  afterCreate?: CrudHookConfig<AfterCreateContext<TEntity, TCreateDto>>;

  // Update hooks
  beforeUpdate?: CrudHookConfig<BeforeUpdateContext<TEntity, TUpdateDto>>;
  afterUpdate?: CrudHookConfig<AfterUpdateContext<TEntity, TUpdateDto>>;

  // Remove hooks
  beforeRemove?: CrudHookConfig<BeforeRemoveContext<TEntity>>;
  afterRemove?: CrudHookConfig<AfterRemoveContext>;

  // Find hooks (optional, read-only)
  beforeFindOne?: CrudHookConfig<BeforeFindOneContext>;
  afterFindOne?: CrudHookConfig<AfterFindOneContext<TEntity>>;

  // Custom hooks (for any operation)
  custom?: CrudHookConfig<any>[];
}
```

### Transaction Configuration

```typescript
interface TransactionConfig {
  isolationLevel?:
    | 'READ UNCOMMITTED'
    | 'READ COMMITTED'
    | 'REPEATABLE READ'
    | 'SERIALIZABLE';
  timeout?: number; // milliseconds, default: 30000
}
```

---

## Implementation Steps

### Step 1: Create Hook Types File

**Create new file:** `libs/nest-crud/src/lib/interfaces/hooks.interface.ts`

```typescript
/**
 * Hook function signature for CRUD operations.
 * Can be synchronous or asynchronous.
 */
export type CrudHook<TContext = any> = (context: TContext) => Promise<any> | any;

/**
 * Configuration for a CRUD hook.
 */
export interface CrudHookConfig<TContext = any> {
  /** The hook function to execute */
  handler: CrudHook<TContext>;
  /**
   * Whether to execute in a transaction.
   * If true and the hook fails, all changes roll back.
   * @default false
   */
  transaction?: boolean;
}

/**
 * Context for beforeCreate hook.
 */
export interface BeforeCreateContext<TEntity, TCreateDto> {
  /** The payload being created */
  payload: TCreateDto;
  /** The entity (available if already created) */
  entity?: TEntity;
}

/**
 * Context for afterCreate hook.
 */
export interface AfterCreateContext<TEntity, TCreateDto> {
  /** The created entity */
  entity: TEntity;
  /** The original payload */
  payload: TCreateDto;
}

/**
 * Context for beforeUpdate hook.
 */
export interface BeforeUpdateContext<TEntity, TUpdateDto> {
  /** The update payload */
  payload: TUpdateDto;
  /** The existing entity */
  entity: TEntity;
  /** The entity ID */
  id: number;
}

/**
 * Context for afterUpdate hook.
 */
export interface AfterUpdateContext<TEntity, TUpdateDto> {
  /** The updated entity */
  entity: TEntity;
  /** The original payload */
  payload: TUpdateDto;
  /** The entity ID */
  id: number;
}

/**
 * Context for beforeRemove hook.
 */
export interface BeforeRemoveContext<TEntity> {
  /** The entity being removed */
  entity: TEntity;
  /** The entity ID */
  id: number;
}

/**
 * Context for afterRemove hook.
 */
export interface AfterRemoveContext {
  /** The entity ID */
  id: number;
  /** Whether deletion was successful */
  deleted: boolean;
}

/**
 * Context for beforeFindOne hook.
 */
export interface BeforeFindOneContext {
  /** The entity ID */
  id: number;
}

/**
 * Context for afterFindOne hook.
 */
export interface AfterFindOneContext<TEntity> {
  /** The found entity */
  entity: TEntity;
  /** The entity ID */
  id: number;
}

/**
 * Complete hooks interface for CRUD operations.
 */
export interface CrudHooks<TEntity, TCreateDto, TUpdateDto> {
  /** Hook before creating an entity */
  beforeCreate?: CrudHookConfig<BeforeCreateContext<TEntity, TCreateDto>>;
  /** Hook after creating an entity */
  afterCreate?: CrudHookConfig<AfterCreateContext<TEntity, TCreateDto>>;

  /** Hook before updating an entity */
  beforeUpdate?: CrudHookConfig<BeforeUpdateContext<TEntity, TUpdateDto>>;
  /** Hook after updating an entity */
  afterUpdate?: CrudHookConfig<AfterUpdateContext<TEntity, TUpdateDto>>;

  /** Hook before removing an entity */
  beforeRemove?: CrudHookConfig<BeforeRemoveContext<TEntity>>;
  /** Hook after removing an entity */
  afterRemove?: CrudHookConfig<AfterRemoveContext>;

  /** Hook before finding an entity */
  beforeFindOne?: CrudHookConfig<BeforeFindOneContext>;
  /** Hook after finding an entity */
  afterFindOne?: CrudHookConfig<AfterFindOneContext<TEntity>>;

  /** Custom hooks for any operation */
  custom?: CrudHookConfig<any>[];
}

/**
 * Transaction configuration for CRUD operations.
 */
export interface TransactionConfig {
  /**
   * PostgreSQL isolation level.
   * @default 'READ COMMITTED'
   */
  isolationLevel?:
    | 'READ UNCOMMITTED'
    | 'READ COMMITTED'
    | 'REPEATABLE READ'
    | 'SERIALIZABLE';

  /**
   * Transaction timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;
}
```

**Guardrail:** No dependencies on other CRUD files - pure type definitions.

### Step 2: Update Service Options Interface

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (lines 10-24):**
```typescript
export interface CrudServiceOptions<Entity extends ObjectLiteral, ResponseDto> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity)[];
  allowedSortFields?: readonly (keyof Entity)[];
  include?: readonly string[];
  relations?: {
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;
  }[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
  disabledEndpoints?: readonly CrudEndpoint[];
}
```

**Updated code:**
```typescript
import { CrudHooks, TransactionConfig } from '../interfaces/hooks.interface';

export interface CrudServiceOptions<Entity extends ObjectLiteral, ResponseDto> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity)[];
  allowedSortFields?: readonly (keyof Entity)[];
  include?: readonly string[];
  relations?: {
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;
  }[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
  disabledEndpoints?: readonly CrudEndpoint[];
  /** Hooks to execute before/after CRUD operations */
  hooks?: CrudHooks<Entity, any, any>;
  /** Transaction configuration for hooks */
  transactionConfig?: TransactionConfig;
}
```

**Guardrail:** All new fields are optional - no breaking changes.

### Step 3: Add Transaction Helper Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

Add new private method after the constructor:

```typescript
/**
 * Execute a function within a database transaction.
 * Automatically commits on success, rolls back on failure.
 */
private async executeInTransaction<T>(
  fn: () => Promise<T>,
  isolationLevel?: string
): Promise<T> {
  const queryRunner = this.repo.manager.connection.createQueryRunner();

  await queryRunner.startTransaction({
    isolationLevel: isolationLevel as any,
  });

  try {
    const result = await fn();
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Execute a hook with optional transaction support.
 */
private async executeHook<TContext>(
  hook: CrudHookConfig<TContext> | undefined,
  context: TContext
): Promise<void> {
  if (!hook) return;

  if (hook.transaction) {
    await this.executeInTransaction(
      () => hook.handler(context),
      this.transactionConfig?.isolationLevel
    );
  } else {
    await hook.handler(context);
  }
}
```

**Guardrail:** Transaction helper is private - no API changes.

### Step 4: Update Constructor to Store Hooks

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (lines 50-60):**
```typescript
constructor(options: CrudServiceOptions<Entity, ResponseDto>) {
  this.repo = options.repository;
  this.allowedFilters = options.allowedFilters ?? [];
  this.allowedSortFields = options.allowedSortFields ?? [];
  this.include = options.include ?? [];
  this.relations = options.relations ?? [];
  this.toResponseDto = options.toResponseDto;
  this.createDtoClass = options.createDtoClass;
  this.updateDtoClass = options.updateDtoClass;
  this.disabledEndpoints = options.disabledEndpoints ?? [];
}
```

**Updated code:**
```typescript
protected readonly hooks: CrudHooks<Entity, any, any>;
protected readonly transactionConfig: TransactionConfig;

constructor(options: CrudServiceOptions<Entity, ResponseDto>) {
  this.repo = options.repository;
  this.allowedFilters = options.allowedFilters ?? [];
  this.allowedSortFields = options.allowedSortFields ?? [];
  this.include = options.include ?? [];
  this.relations = options.relations ?? [];
  this.toResponseDto = options.toResponseDto;
  this.createDtoClass = options.createDtoClass;
  this.updateDtoClass = options.updateDtoClass;
  this.disabledEndpoints = options.disabledEndpoints ?? [];
  this.hooks = options.hooks ?? {};
  this.transactionConfig = options.transactionConfig ?? {};
}
```

**Guardrail:** All new fields have defaults - no breaking changes.

### Step 5: Update create() Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (lines 150-160):**
```typescript
async create(payload: CreateDto) {
  const resolved = await this.resolveRelations(
    payload as unknown as ObjectLiteral
  );

  const entity = await this.repo.save(resolved as unknown as Entity);

  return this.toResponseDto
    ? (this.toResponseDto(entity) as ResponseDto)
    : (entity as unknown as ResponseDto);
}
```

**Updated code:**
```typescript
async create(payload: CreateDto): Promise<ResponseDto> {
  // Execute beforeCreate hook
  await this.executeHook(this.hooks.beforeCreate, { payload });

  // Core CRUD operation
  const resolved = await this.resolveRelations(
    payload as unknown as ObjectLiteral
  );

  const entity = await this.repo.save(resolved as unknown as Entity);

  const result = this.toResponseDto
    ? (this.toResponseDto(entity) as ResponseDto)
    : (entity as unknown as ResponseDto);

  // Execute afterCreate hook
  await this.executeHook(this.hooks.afterCreate, { entity, payload });

  return result;
}
```

**Guardrail:** Hook execution is optional - no breaking changes if hooks not provided.

### Step 6: Update update() Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (lines 162-179):**
```typescript
async update(id: number, payload: UpdateDto) {
  const existing = await this.repo.findOneBy({
    id,
  } as unknown as Partial<Entity>);

  if (!existing) {
    throw new NotFoundException('Resource not found');
  }

  const resolved = await this.resolveRelations(
    payload as unknown as ObjectLiteral
  );

  this.repo.merge(existing, resolved as DeepPartial<Entity>);
  await this.repo.save(existing);

  return this.findOne(id);
}
```

**Updated code:**
```typescript
async update(id: number, payload: UpdateDto): Promise<ResponseDto> {
  const existing = await this.repo.findOneBy({
    id,
  } as unknown as Partial<Entity>);

  if (!existing) {
    throw new NotFoundException('Resource not found');
  }

  // Execute beforeUpdate hook
  await this.executeHook(this.hooks.beforeUpdate, { payload, entity: existing, id });

  const resolved = await this.resolveRelations(
    payload as unknown as ObjectLiteral
  );

  this.repo.merge(existing, resolved as DeepPartial<Entity>);
  await this.repo.save(existing);

  const result = await this.findOne(id);

  // Execute afterUpdate hook
  await this.executeHook(this.hooks.afterUpdate, { entity: result as any, payload, id });

  return result;
}
```

**Guardrail:** Hook execution is optional - no breaking changes if hooks not provided.

### Step 7: Update remove() Method

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (lines 181-189):**
```typescript
async remove(id: number) {
  const result = await this.repo.delete(id);

  if (result.affected === 0) {
    throw new NotFoundException('Resource not found');
  }

  return true;
}
```

**Updated code:**
```typescript
async remove(id: number): Promise<boolean> {
  const existing = await this.repo.findOneBy({
    id,
  } as unknown as Partial<Entity>);

  if (!existing) {
    throw new NotFoundException('Resource not found');
  }

  // Execute beforeRemove hook
  await this.executeHook(this.hooks.beforeRemove, { entity: existing, id });

  const result = await this.repo.delete(id);

  const deleted = result.affected !== 0;

  // Execute afterRemove hook
  await this.executeHook(this.hooks.afterRemove, { id, deleted });

  return deleted;
}
```

**Guardrail:** Pre-fetch entity for hook context - minimal performance impact.

### Step 8: Update findOne() Method (Optional)

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

**Current code (lines 135-148):**
```typescript
async findOne(id: number) {
  const entity = await this.repo.findOne({
    where: { id } as unknown as Partial<Entity>,
    relations: this.include as string[],
  });

  if (!entity) {
    throw new NotFoundException('Resource not found');
  }

  return this.toResponseDto
    ? (this.toResponseDto(entity) as ResponseDto)
    : (entity as unknown as ResponseDto);
}
```

**Updated code:**
```typescript
async findOne(id: number): Promise<ResponseDto> {
  // Execute beforeFindOne hook (optional)
  await this.executeHook(this.hooks.beforeFindOne, { id });

  const entity = await this.repo.findOne({
    where: { id } as unknown as Partial<Entity>,
    relations: this.include as string[],
  });

  if (!entity) {
    throw new NotFoundException('Resource not found');
  }

  const result = this.toResponseDto
    ? (this.toResponseDto(entity) as ResponseDto)
    : (entity as unknown as ResponseDto);

  // Execute afterFindOne hook (optional)
  await this.executeHook(this.hooks.afterFindOne, { entity, id });

  return result;
}
```

**Guardrail:** Find hooks are optional and read-only - no side effects.

### Step 9: Update findAll() Method (Optional)

**File:** `libs/nest-crud/src/lib/services/nest-crud.service.ts`

Add before/after hooks for findAll (optional, read-only):

```typescript
async findAll(query: PaginationDto & FilterDto) {
  // Execute custom hooks
  if (this.hooks.custom) {
    for (const hook of this.hooks.custom) {
      await this.executeHook(hook, { query, operation: 'findAll' });
    }
  }

  // ... existing code ...

  return paginationMeta
    ? { data, meta: { ...paginationMeta, total } }
    : { data };
}
```

**Guardrail:** Custom hooks are optional - no breaking changes.

### Step 10: Update CRUD Interface

**File:** `libs/nest-crud/src/lib/interfaces/crud.interface.ts`

No changes needed - hooks are service-level implementation details.

### Step 11: Export Hook Types

**File:** `libs/nest-crud/src/index.ts`

Add export for hook types:

```typescript
export * from './lib/interfaces/hooks.interface';
```

**Guardrail:** New exports only - no breaking changes.

### Step 12: Write Unit Tests

**Create new file:** `libs/nest-crud/src/lib/services/nest-crud.service.hooks.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from './nest-crud.service';
import { CrudHooks, TransactionConfig } from '../interfaces/hooks.interface';

describe('NestCrudService - Hooks', () => {
  let service: NestCrudService<any, any, any, any>;
  let repo: jest.Mocked<Repository<any>>;

  const mockEntity = { id: 1, name: 'Test' };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([mockEntity]),
      findOne: jest.fn().mockResolvedValue(mockEntity),
      findOneBy: jest.fn().mockResolvedValue(mockEntity),
      save: jest.fn().mockResolvedValue(mockEntity),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockReturnValue(mockEntity),
      merge: jest.fn(),
      createQueryBuilder: jest.fn(),
      metadata: { name: 'TestEntity' },
      manager: {
        connection: {
          createQueryRunner: jest.fn(),
        },
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NestCrudService,
        { provide: getRepositoryToken(Object), useValue: repo },
      ],
    }).compile();

    service = module.get<NestCrudService<any, any, any, any>>(NestCrudService);
  });

  describe('beforeCreate hook', () => {
    it('should execute beforeCreate hook', async () => {
      const beforeCreateFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        beforeCreate: { handler: beforeCreateFn, transaction: false },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.create({ name: 'Test' });

      expect(beforeCreateFn).toHaveBeenCalledWith({
        payload: { name: 'Test' },
      });
    });

    it('should execute beforeCreate hook in transaction', async () => {
      const beforeCreateFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        beforeCreate: { handler: beforeCreateFn, transaction: true },
      };

      const queryRunner = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      repo.manager.connection.createQueryRunner.mockReturnValue(queryRunner);

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.create({ name: 'Test' });

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction if beforeCreate hook fails', async () => {
      const beforeCreateFn = jest.fn().mockRejectedValue(new Error('Hook failed'));
      const hooks: CrudHooks<any, any, any> = {
        beforeCreate: { handler: beforeCreateFn, transaction: true },
      };

      const queryRunner = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      repo.manager.connection.createQueryRunner.mockReturnValue(queryRunner);

      service = new NestCrudService({ repository: repo as any, hooks });

      await expect(service.create({ name: 'Test' })).rejects.toThrow('Hook failed');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('afterCreate hook', () => {
    it('should execute afterCreate hook', async () => {
      const afterCreateFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        afterCreate: { handler: afterCreateFn, transaction: false },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.create({ name: 'Test' });

      expect(afterCreateFn).toHaveBeenCalledWith({
        entity: mockEntity,
        payload: { name: 'Test' },
      });
    });
  });

  describe('beforeUpdate hook', () => {
    it('should execute beforeUpdate hook', async () => {
      const beforeUpdateFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        beforeUpdate: { handler: beforeUpdateFn, transaction: false },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.update(1, { name: 'Updated' });

      expect(beforeUpdateFn).toHaveBeenCalledWith({
        payload: { name: 'Updated' },
        entity: mockEntity,
        id: 1,
      });
    });
  });

  describe('afterUpdate hook', () => {
    it('should execute afterUpdate hook', async () => {
      const afterUpdateFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        afterUpdate: { handler: afterUpdateFn, transaction: false },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.update(1, { name: 'Updated' });

      expect(afterUpdateFn).toHaveBeenCalledWith({
        entity: mockEntity,
        payload: { name: 'Updated' },
        id: 1,
      });
    });
  });

  describe('beforeRemove hook', () => {
    it('should execute beforeRemove hook', async () => {
      const beforeRemoveFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        beforeRemove: { handler: beforeRemoveFn, transaction: false },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.remove(1);

      expect(beforeRemoveFn).toHaveBeenCalledWith({
        entity: mockEntity,
        id: 1,
      });
    });
  });

  describe('afterRemove hook', () => {
    it('should execute afterRemove hook', async () => {
      const afterRemoveFn = jest.fn();
      const hooks: CrudHooks<any, any, any> = {
        afterRemove: { handler: afterRemoveFn, transaction: false },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.remove(1);

      expect(afterRemoveFn).toHaveBeenCalledWith({
        id: 1,
        deleted: true,
      });
    });
  });

  describe('multiple hooks', () => {
    it('should execute hooks in order', async () => {
      const executionOrder: string[] = [];
      const hooks: CrudHooks<any, any, any> = {
        beforeCreate: {
          handler: async () => {
            executionOrder.push('beforeCreate');
          },
          transaction: false,
        },
        afterCreate: {
          handler: async () => {
            executionOrder.push('afterCreate');
          },
          transaction: false,
        },
      };

      service = new NestCrudService({ repository: repo as any, hooks });

      await service.create({ name: 'Test' });

      expect(executionOrder).toEqual(['beforeCreate', 'afterCreate']);
    });
  });

  describe('no hooks', () => {
    it('should work without hooks', async () => {
      service = new NestCrudService({ repository: repo as any });

      const result = await service.create({ name: 'Test' });

      expect(result).toEqual(mockEntity);
    });
  });
});
```

**Guardrail:** Tests cover all hook types and transaction scenarios.

### Step 13: Write Integration Tests

**Create new file:** `libs/nest-crud/src/lib/services/nest-crud.service.hooks.integration.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from './nest-crud.service';

// Integration test with real database
describe('NestCrudService - Hooks Integration', () => {
  // ... integration test setup
});
```

**Guardrail:** Integration tests verify real transaction behavior.

---

## Usage Examples

### Example 1: Simple Validation Hook

```typescript
const postService = new NestCrudService(Post, {
  repository: postRepo,
  hooks: {
    beforeCreate: {
      handler: async ({ payload }) => {
        if (payload.title.length < 5) {
          throw new BadRequestException('Title must be at least 5 characters');
        }
        if (payload.title.length > 100) {
          throw new BadRequestException('Title must be at most 100 characters');
        }
        return payload;
      },
      transaction: false, // No transaction needed for validation
    },
  },
});
```

### Example 2: Audit + Notification (Transactional)

```typescript
const postService = new NestCrudService(Post, {
  repository: postRepo,
  hooks: {
    afterCreate: {
      handler: async ({ entity }) => {
        // Log to audit trail
        await auditLogService.log({
          action: 'CREATE',
          entity: 'Post',
          entityId: entity.id.toString(),
          metadata: { title: entity.title },
        });

        // Send notification
        await notificationService.sendPostCreated(entity);

        // Invalidate cache
        await cacheService.invalidate('posts');
      },
      transaction: true, // Rollback if any step fails
    },
  },
  transactionConfig: {
    isolationLevel: 'READ COMMITTED',
    timeout: 5000,
  },
});
```

### Example 3: Complex Multi-Hook Pipeline

```typescript
const postService = new NestCrudService(Post, {
  repository: postRepo,
  hooks: {
    beforeCreate: {
      handler: async ({ payload }) => {
        // Add metadata
        payload.createdAt = new Date();
        payload.authorId = getCurrentUserId();
        payload.slug = generateSlug(payload.title);
        return payload;
      },
      transaction: false,
    },
    afterCreate: {
      handler: async ({ entity }) => {
        // Index for search
        await searchIndexService.index(entity);

        // Update author's post count
        await authorService.incrementPostCount(entity.authorId);

        // Send webhook
        await webhookService.send('post.created', entity);
      },
      transaction: true,
    },
    beforeUpdate: {
      handler: async ({ payload, entity }) => {
        // Track changes
        payload.changedFields = Object.keys(payload);
        payload.previousValues = { ...entity };
        return payload;
      },
      transaction: false,
    },
    afterUpdate: {
      handler: async ({ entity, payload }) => {
        // Re-index for search
        await searchIndexService.update(entity);

        // Invalidate cache
        await cacheService.invalidate(`post:${entity.id}`);
        await cacheService.invalidate('posts');
      },
      transaction: true,
    },
  },
  transactionConfig: {
    isolationLevel: 'REPEATABLE READ',
    timeout: 10000,
  },
});
```

### Example 4: Permission Check Hook

```typescript
const postService = new NestCrudService(Post, {
  repository: postRepo,
  hooks: {
    beforeUpdate: {
      handler: async ({ payload, entity, id }) => {
        const currentUser = getCurrentUser();

        // Check ownership
        if (entity.authorId !== currentUser.id) {
          throw new ForbiddenException('You can only update your own posts');
        }

        // Check role
        if (!currentUser.roles.includes('admin') && payload.status === 'published') {
          throw new ForbiddenException('Only admins can publish posts');
        }

        return payload;
      },
      transaction: false,
    },
    beforeRemove: {
      handler: async ({ entity, id }) => {
        const currentUser = getCurrentUser();

        // Check ownership
        if (entity.authorId !== currentUser.id) {
          throw new ForbiddenException('You can only delete your own posts');
        }

        return entity;
      },
      transaction: false,
    },
  },
});
```

### Example 5: Custom Hooks for Specific Operations

```typescript
const postService = new NestCrudService(Post, {
  repository: postRepo,
  hooks: {
    custom: [
      {
        handler: async (context) => {
          // Log all operations
          await logger.log({
            operation: context.operation,
            timestamp: new Date(),
            userId: getCurrentUserId(),
          });
        },
        transaction: false,
      },
      {
        handler: async (context) => {
          // Rate limiting
          const userId = getCurrentUserId();
          const key = `rate_limit:${userId}:${context.operation}`;
          const count = await redis.incr(key);
          if (count > 100) {
            throw new TooManyRequestsException('Rate limit exceeded');
          }
          await redis.expire(key, 3600);
        },
        transaction: false,
      },
    ],
  },
});
```

---

## Acceptance Criteria

### Must Pass

- [ ] `npx nx run-many -t typecheck` passes with no errors
- [ ] `npx nx run-many -t lint` passes with no errors
- [ ] `npx nx run-many -t test` passes with all tests green
- [ ] `npx nx run-many -t build` produces valid dist output
- [ ] `npx nx serve demo-api` starts without errors
- [ ] Existing CRUD operations work without hooks (backward compatible)
- [ ] beforeCreate hook executes before entity is saved
- [ ] afterCreate hook executes after entity is saved
- [ ] beforeUpdate hook executes before entity is updated
- [ ] afterUpdate hook executes after entity is updated
- [ ] beforeRemove hook executes before entity is deleted
- [ ] afterRemove hook executes after entity is deleted
- [ ] Transactional hooks roll back on failure
- [ ] Non-transactional hooks execute independently
- [ ] Multiple hooks execute in order
- [ ] Custom hooks execute for any operation

### Should Pass

- [ ] Hook context contains correct data
- [ ] Transaction isolation level is configurable
- [ ] Transaction timeout is configurable
- [ ] Error messages from hooks are clear
- [ ] Performance impact is minimal (< 5ms overhead)

### Nice to Have

- [ ] Hook execution time is logged
- [ ] Hook errors include stack traces
- [ ] Hook configuration is validated at startup

---

## Rollback Plan

If critical issues arise:

1. Revert service changes
2. Remove hooks interface file
3. Run full test suite

```bash
git checkout -- libs/nest-crud/src/lib/services/nest-crud.service.ts
rm libs/nest-crud/src/lib/interfaces/hooks.interface.ts
npx nx run-many -t test
```

---

## Best Practices

### Query Performance

1. **Index verification:** Ensure hooks don't cause N+1 queries
2. **Batch operations:** Use transactions for multiple related operations
3. **Connection pooling:** Release query runners promptly in finally block

### Readability

1. **Hook naming:** Use descriptive names for hook functions
2. **Context documentation:** Document all available context properties
3. **Error messages:** Provide clear error messages in hooks

### Maintainability

1. **Hook isolation:** Keep hooks focused on single responsibility
2. **Error handling:** Always handle errors in hooks
3. **Testing:** Write tests for all custom hooks
4. **Documentation:** Document hook behavior in code comments
