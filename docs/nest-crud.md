# @nest-util/nest-crud

A generic and flexible CRUD system for NestJS and TypeORM.

## Installation

```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
```

## Core Components

### 1. NestCrudService
The base service handling database interactions. Extend this in your services.

```typescript
import { NestCrudService } from '@nest-util/nest-crud';

export class MyService extends NestCrudService<Entity, CreateDto, UpdateDto> {
  constructor(repository: Repository<Entity>) {
    super({ repository, allowedFilters: ['name'] });
  }
}
```

### 2. CreateNestedCrudController
A controller factory that generates CRUD endpoints.

```typescript
import { CreateNestedCrudController } from '@nest-util/nest-crud';

export class MyController extends CreateNestedCrudController(
  CreateDto,
  UpdateDto,
  Entity
) {
  constructor(override readonly service: MyService) {
    super(service);
  }
}
```

### 3. IBaseController
An interface for the generated controller, useful for resolving TypeScript portability issues.

## Features
- Automatic pagination and filtering.
- Swagger documentation integration.
- Response interceptors for consistent API responses.
