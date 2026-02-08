# @nest-util/nest-crud

> A powerful, flexible CRUD library for NestJS and TypeORM with automatic pagination, filtering, and Swagger documentation

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Components](#core-components)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Filtering Guide](#filtering-guide)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

---

## Overview

`@nest-util/nest-crud` eliminates the repetitive work of building CRUD operations for every entity in your NestJS application. It provides:

- **Generic Services**: Base service class with common database operations
- **Controller Factory**: Dynamically generates controller classes with CRUD endpoints
- **Automatic Pagination**: Built-in support for page-based pagination
- **Advanced Filtering**: Query-based filtering with multiple operators
- **Swagger Integration**: Automatic OpenAPI documentation
- **Type Safety**: Full TypeScript support with proper type inference
- **Custom Responses**: Interceptors for consistent API response format
- **Error Handling**: Global exception filter for database errors

### Why Use nest-crud?

| Without nest-crud | With nest-crud |
|-------------------|----------------|
| Write CRUD logic for every entity | Extend `NestCrudService` once |
| Create controller methods manually | Use `CreateNestedCrudController` factory |
| Implement pagination repeatedly | Get it automatically |
| Build filtering from scratch | Use built-in filter operators |
| Write Swagger decorators everywhere | Automatic documentation |
| Handle database errors inconsistently | Global exception filter |

---

## Installation

### Prerequisites

- NestJS v10+
- TypeORM v0.3+
- Node.js v18+

### Install the Package

```bash
# Using pnpm (recommended)
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz

# Using npm
npm install https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
```

### Required Peer Dependencies

```bash
pnpm add @nestjs/typeorm typeorm @nestjs/swagger class-validator class-transformer
```

---

## Quick Start

### Step 1: Create an Entity

```typescript
// user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id!: number;

  @Column()
  @ApiProperty()
  name!: string;

  @Column()
  @ApiProperty()
  email!: string;

  @Column({ default: true })
  @ApiProperty()
  isActive!: boolean;
}
```

### Step 2: Create DTOs

```typescript
// create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;
}

// update-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
```

### Step 3: Create a Service

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { User } from './user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

@Injectable()
export class UserService extends NestCrudService<
  User,
  CreateUserDto,
  UpdateUserDto
> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>
  ) {
    super({
      repository,
      allowedFilters: ['name', 'email', 'isActive'], // Whitelist filterable fields
    });
  }
}
```

### Step 4: Create a Controller

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

@ApiTags('users')
@Controller('users')
export class UserController extends CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  User
) implements IBaseController<CreateUserDto, UpdateUserDto, User> {
  constructor(override readonly service: UserService) {
    super(service);
  }
}
```

### Step 5: Register the Module

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

### Step 6: Configure Global Settings

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable automatic transformation and validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      enableImplicitConversion: true,
    })
  );

  // Handle database errors gracefully
  app.useGlobalFilters(new TypeOrmExceptionFilter());

  // Configure query parser for complex filtering
  app.getHttpAdapter().getInstance().set('query parser', 'extended');

  await app.listen(3000);
}
bootstrap();
```

### Step 7: Use Your API

The following endpoints are now available:

```bash
# Create a user
POST /users
Content-Type: application/json
{"name":"John Doe","email":"john@example.com"}

# Get all users with pagination
GET /users?page=1&limit=10

# Filter users
GET /users?filter[isActive_eq]=true&filter[name_cont]=john

# Get one user
GET /users/1

# Update a user
PATCH /users/1
Content-Type: application/json
{"name":"Jane Doe"}

# Delete a user
DELETE /users/1
```

---

## Core Components

### 1. NestCrudService

The base service class that provides common database operations.

**Type Parameters:**
- `TEntity` - The TypeORM entity class
- `TCreateDto` - DTO for creating entities
- `TUpdateDto` - DTO for updating entities

**Constructor Options:**
```typescript
interface NestCrudServiceOptions<TEntity> {
  repository: Repository<TEntity>;
  allowedFilters?: string[]; // Whitelist of filterable fields
}
```

**Methods:**
- `findAll(query)` - Get all entities with optional pagination and filtering
- `findOne(id)` - Get a single entity by ID
- `create(dto)` - Create a new entity
- `update(id, dto)` - Update an existing entity
- `remove(id)` - Delete an entity (soft delete if supported)

### 2. CreateNestedCrudController

A factory function that generates a controller class with CRUD endpoints.

**Parameters:**
- `createDto: Type<TCreateDto>` - Class for creation DTO
- `updateDto: Type<TUpdateDto>` - Class for update DTO
- `responseDto: Type<TResponseDto>` - Class for response DTO

**Returns:**
A class that can be extended to create your controller.

**Generated Endpoints:**
- `GET /` - List all entities
- `GET /:id` - Get one entity
- `POST /` - Create entity
- `PATCH /:id` - Update entity
- `DELETE /:id` - Delete entity

### 3. IBaseController

Interface for proper TypeScript type inference when extending the controller factory.

```typescript
interface IBaseController<CD, UD, RD> {
  service: CrudInterface<CD, UD, RD>;
  findAll(query: PaginationDto & FilterDto): Promise<{ data: RD[]; meta?: unknown } | RD[]>;
  findOne(id: number): Promise<RD>;
  create(dto: CD): Promise<RD>;
  update(id: number, dto: UD): Promise<RD>;
  remove(id: number): Promise<boolean>;
}
```

### 4. Decorators

#### @Message(message: string)

Sets a custom message for the API response.

```typescript
@Get()
@Message('Successfully fetched users')
async findAll() {
  return this.service.findAll();
}
```

#### @EntityName(options: { singular: string; plural: string })

Customizes entity name in response messages.

```typescript
@Controller('users')
@EntityName({ singular: 'User', plural: 'Users' })
export class UserController extends CreateNestedCrudController(...) {}
```

### 5. DTOs

#### PaginationDto

Used for pagination in query parameters.

```typescript
interface PaginationDto {
  page?: number;  // Page number (1-based)
  limit?: number; // Items per page
}
```

Usage:
```bash
GET /users?page=2&limit=20
```

#### FilterDto

Used for filtering in query parameters.

```typescript
interface FilterDto {
  filter?: Record<string, any>;
}
```

Usage:
```bash
GET /users?filter[name_cont]=john&filter[isActive_eq]=true
```

### 6. Global Filters

#### TypeOrmExceptionFilter

Catches database errors and returns proper HTTP responses.

```typescript
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';

app.useGlobalFilters(new TypeOrmExceptionFilter());
```

**Handled Errors:**
- Unique constraint violations → 409 Conflict
- Foreign key violations → 400 Bad Request
- Not null violations → 400 Bad Request
- Generic database errors → 500 Internal Server Error

---

## API Reference

### NestCrudService Methods

#### findAll(query?: PaginationDto & FilterDto)

Retrieve all entities with optional pagination and filtering.

**Parameters:**
```typescript
query?: {
  page?: number;
  limit?: number;
  filter?: Record<string, any>;
}
```

**Returns:**
```typescript
Promise<{ data: TEntity[];meta?: { page: number; limit: number; total: number } } | TEntity[]>
```

**Example:**
```typescript
// Without pagination
const users = await userService.findAll();

// With pagination
const result = await userService.findAll({ page: 1, limit: 10 });

// With filtering
const activeUsers = await userService.findAll({
  filter: { isActive_eq: 'true' }
});
```

#### findOne(id: number)

Get a single entity by ID.

**Parameters:**
- `id: number` - Entity ID

**Returns:**
```typescript
Promise<TEntity>
```

**Throws:**
- `NotFoundException` if entity not found

**Example:**
```typescript
const user = await userService.findOne(1);
```

#### create(dto: TCreateDto)

Create a new entity.

**Parameters:**
- `dto: TCreateDto` - Data transfer object with creation data

**Returns:**
```typescript
Promise<TEntity>
```

**Example:**
```typescript
const newUser = await userService.create({
  name: 'John Doe',
  email: 'john@example.com'
});
```

#### update(id: number, dto: TUpdateDto)

Update an existing entity.

**Parameters:**
- `id: number` - Entity ID
- `dto: TUpdateDto` - Data transfer object with update data

**Returns:**
```typescript
Promise<TEntity>
```

**Throws:**
- `NotFoundException` if entity not found

**Example:**
```typescript
const updatedUser = await userService.update(1, {
  name: 'Jane Doe'
});
```

#### remove(id: number)

Delete an entity.

**Parameters:**
- `id: number` - Entity ID

**Returns:**
```typescript
Promise<boolean>
```

**Throws:**
- `NotFoundException` if entity not found

**Example:**
```typescript
const result = await userService.remove(1);
// Returns true if successful
```

---

## Advanced Usage

### Custom Service Methods

Add custom business logic while keeping CRUD functionality:

```typescript
@Injectable()
export class UserService extends NestCrudService<User, CreateUserDto, UpdateUserDto> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super({
      repository,
      allowedFilters: ['name', 'email', 'isActive'],
    });
  }

  // Custom method: Find active users
  async findActiveUsers(): Promise<User[]> {
    return this.repository.find({ where: { isActive: true } });
  }

  // Custom method: Deactivate user
  async deactivateUser(id: number): Promise<User> {
    const user = await this.findOne(id);
    return this.update(id, { isActive: false } as UpdateUserDto);
  }

  // Override create to add custom logic
  override async create(dto: CreateUserDto): Promise<User> {
    // Custom validation or transformation
    const normalizedEmail = dto.email.toLowerCase();
    
    // Check if email already exists
    const existing = await this.repository.findOne({
      where: { email: normalizedEmail }
    });
    
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    return super.create({ ...dto, email: normalizedEmail });
  }
}
```

### Custom Controller Endpoints

Mix generated CRUD endpoints with custom routes:

```typescript
@Controller('users')
export class UserController extends CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  User
) implements IBaseController<CreateUserDto, UpdateUserDto, User> {
  constructor(override readonly service: UserService) {
    super(service);
  }

  // Add custom endpoints
  @Get('active')
  @Message('fetched active users')
  @ApiResponse({ type: [User] })
  async getActiveUsers() {
    return this.service.findActiveUsers();
  }

  @Post(':id/deactivate')
  @Message('user deactivated')
  @ApiResponse({ type: User })
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deactivateUser(id);
  }

  // Override existing endpoints
  @Get()
  @Message('fetched users with custom logic')
  override async findAll(@Query() query: PaginationDto & FilterDto) {
    // Add custom logic before calling parent
    const result = await super.findAll(query);
    // Add custom logic after
    return result;
  }
}
```

### Relations and Eager Loading

Handle entity relations in your service:

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title', 'published', 'authorId'],
    });
  }

  // Override findAll to include relations
  override async findAll(query?: any) {
    const { page, limit, filter } = query || {};
    
    const queryBuilder = this.repository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.comments', 'comments');

    // Apply filters if needed
    // Apply pagination
    if (page && limit) {
      queryBuilder.skip((page - 1) * limit).take(limit);
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return page && limit
      ? { data, meta: { page, limit, total } }
      : data;
  }

  // Override findOne to include relations
  override async findOne(id: number) {
    const post = await this.repository.findOne({
      where: { id },
      relations: ['author', 'comments'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return post;
  }
}
```

---

## Filtering Guide

### Filter Operators

The CRUD system supports the following filter operators:

| Operator | Description | Example | SQL Equivalent |
|----------|-------------|---------|----------------|
| `eq` | Equals | `?filter[status_eq]=active` | `WHERE status = 'active'` |
| `cont` | Contains (case-insensitive) | `?filter[name_cont]=john` | `WHERE LOWER(name) LIKE '%john%'` |
| `gte` | Greater than or equal | `?filter[age_gte]=18` | `WHERE age >= 18` |
| `lte` | Less than or equal | `?filter[age_lte]=65` | `WHERE age <= 65` |

### Filter Syntax

Filters are passed as query parameters in the format:

```
?filter[field_operator]=value
```

### Single Filter Examples

```bash
# Equality
GET /users?filter[isActive_eq]=true

# Contains
GET /users?filter[name_cont]=john

# Greater than or equal
GET /users?filter[age_gte]=18

# Less than or equal
GET /users?filter[createdAt_lte]=2024-01-01
```

### Multiple Filters

Combine multiple filters in a single request:

```bash
# Active users named John who are 18+
GET /users?filter[isActive_eq]=true&filter[name_cont]=john&filter[age_gte]=18
```

### Whitelisting Filterable Fields

For security, you must whitelist fields that can be filtered:

```typescript
super({
  repository,
  allowedFilters: ['name', 'email', 'isActive', 'age'], // Only these can be filtered
});
```

Attempting to filter on non-whitelisted fields will be ignored.

### Pagination with Filters

Combine filtering with pagination:

```bash
GET /users?page=1&limit=10&filter[isActive_eq]=true&filter[age_gte]=18
```

---

## Best Practices

### 1. Always Use IBaseController

Prevent TypeScript inference errors by implementing the interface:

```typescript
export class UserController extends CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  User
) implements IBaseController<CreateUserDto, UpdateUserDto, User> {
  // ...
}
```

### 2. Whitelist Filterable Fields

Only expose fields that should be filterable:

```typescript
super({
  repository,
  allowedFilters: ['name', 'email'], // Don't expose sensitive fields like 'password'
});
```

### 3. Use Proper DTOs

Separate DTOs for create, update, and response:

```typescript
// Create DTO - all required fields
export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

// Update DTO - all optional fields
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

// Response DTO - excludes sensitive fields
export class UserResponseDto {
  id!: number;
  name!: string;
  email!: string;
  // password field excluded
}
```

### 4. Configure Global ValidationPipe

Enable automatic transformation:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    enableImplicitConversion: true,
    whitelist: true, // Strip properties not in DTO
    forbidNonWhitelisted: true, // Throw error for unexpected properties
  })
);
```

### 5. Use Global Exception Filter

Handle database errors consistently:

```typescript
app.useGlobalFilters(new TypeOrmExceptionFilter());
```

### 6. Document with Swagger

Add comprehensive API documentation:

```typescript
@ApiTags('users')
@Controller('users')
@ApiExtraModels(CreateUserDto, UpdateUserDto, User)
export class UserController extends CreateNestedCrudController(...) {
  // ...
}
```

### 7. Export Services for Reuse

Make services available to other modules:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export for use in other modules
})
export class UserModule {}
```

---

## Troubleshooting

### TypeScript Error: TS2742

**Error:**
```
The inferred type of 'MyController' cannot be named without a reference to 
'node_modules/@nestjs/common'. This is likely not portable.
```

**Solution:**
Add `implements IBaseController`:

```typescript
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';

export class MyController extends CreateNestedCrudController(
  CreateDto,
  UpdateDto,
  ResponseDto
) implements IBaseController<CreateDto, UpdateDto, ResponseDto> {
  // ...
}
```

### Filtering Not Working

**Problem:** Filters are ignored

**Solutions:**
1. Ensure query parser is configured:
```typescript
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

2. Whitelist fields in service:
```typescript
super({
  repository,
  allowedFilters: ['name', 'email', 'status'], // Add filterablefields
});
```

3. Use correct filter syntax:
```bash
# Correct
GET /users?filter[name_cont]=john

# Incorrect
GET /users?name=john
```

### Pagination Returns All Records

**Problem:** Pagination parameters are ignored

**Solution:**
Enable implicit conversion:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    enableImplicitConversion: true, // Convert string to number
  })
);
```

### Database Errors Not Handled

**Problem:** Raw database errors exposed to clients

**Solution:**
Install global exception filter:

```typescript
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
app.useGlobalFilters(new TypeOrmExceptionFilter());
```

---

## Examples

### Example 1: Blog API

Complete blog API with posts, comments, and authors:

```typescript
// post.entity.ts
@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  @Column({ default: false })
  published!: boolean;

  @ManyToOne(() => User)
  author!: User;

  @OneToMany(() => Comment, comment => comment.post)
  comments!: Comment[];
}

// post.service.ts
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title', 'published', 'authorId'],
    });
  }

  async findPublished() {
    return this.repository.find({
      where: { published: true },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }
}

// post.controller.ts
@Controller('posts')
export class PostController extends CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post
) implements IBaseController<CreatePostDto, UpdatePostDto, Post> {
  constructor(override readonly service: PostService) {
    super(service);
  }

  @Get('published')
  getPublished() {
    return this.service.findPublished();
  }
}
```

### Example 2: E-commerce Products

Product catalog with categories and inventory:

```typescript
// product.service.ts
@Injectable()
export class ProductService extends NestCrudService<
  Product,
  CreateProductDto,
  UpdateProductDto
> {
  constructor(@InjectRepository(Product) repository: Repository<Product>) {
    super({
      repository,
      allowedFilters: ['name', 'category', 'inStock', 'price'],
    });
  }

  async findByCategory(category: string) {
    return this.repository.find({ where: { category } });
  }

  async findInStock() {
    return this.repository.find({
      where: { inStock: true },
      order: { price: 'ASC' },
    });
  }

  async updateStock(id: number, quantity: number) {
    const product = await this.findOne(id);
    product.quantity = quantity;
    product.inStock = quantity > 0;
    return this.repository.save(product);
  }
}
```

---

## Summary

`@nest-util/nest-crud` provides a complete solution for building CRUD APIs in NestJS:

✅ **Rapid Development** - Generate CRUD operations in minutes
✅ **Type Safe** - Full TypeScript support with proper inference
✅ **Flexible** - Extend and customize as needed
✅ **Production Ready** - Battle-tested patterns and error handling
✅ **Well Documented** - Automatic Swagger documentation
✅ **Consistent** - Standardized API responses and patterns

**Next Steps:**
- [Getting Started Guide](getting-started) - Build your first application
- [Authentication](nest-auth) - Secure your API
- [Code Generator](ncnu) - Automate resource creation
- [Examples](examples) - See more real-world use cases
