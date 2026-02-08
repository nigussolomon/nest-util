# ncnu - NestJS CRUD Generator

> A powerful CLI tool that generates complete CRUD resources for NestJS applications with proper TypeScript types, validation, and Swagger documentation

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Reference](#cli-reference)
- [Field Types Reference](#field-types-reference)
- [Generated Code Structure](#generated-code-structure)
- [Usage Examples](#usage-examples)
- [Integration Workflow](#integration-workflow)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

`ncnu` (NestJS CRUD Utility) eliminates the tedious work of scaffolding CRUD resources. With a single command, it generates:

- ✅ **TypeORM Entity** with proper column decorators
- ✅ **Create DTO** with validation decorators
- ✅ **Update DTO** with optional fields
- ✅ **Service** extending `NestCrudService`
- ✅ **Controller** extending `CreateNestedCrudController`
- ✅ **Swagger Documentation** with all ApiProperty decorators
- ✅ **TypeScript Strict Mode** compatible (definite assignment assertions)

### Why Use ncnu?

| Manual Approach | With ncnu |
|-----------------|-----------|
| Create 5 files manually | One command |
| Copy-paste boilerplate | Auto-generated code |
| Manually add decorators | All decorators included |
| Risk of inconsistency | Consistent patterns |
| 15-30 minutes per resource | 5 seconds |

---

## Installation

### Global Installation (Recommended)

Install globally for easy access from any project:

```bash
# Using pnpm (recommended)
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz

# Using npm
npm install -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz

# Verify installation
ncnu --help
```

### Local Installation

Install as a dev dependency in your project:

```bash
pnpm add -D https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz

# Use with npx
npx ncnu --help
```

### Use Without Installing

Use npx to run without installing:

```bash
npx https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz \
  --gen User --path ./src/app email:string name:string
```

---

## Quick Start

### 1. Generate a Resource

```bash
ncnu --gen User --path apps/my-api/src/app \
  email:string \
  name:string \
  age:number \
  isActive:boolean
```

### 2. Generated Files

This creates:

```
apps/my-api/src/app/user/
├── user.entity.ts              # TypeORM entity
├── create-user.dto.ts          # Creation DTO
├── update-user.dto.ts          # Update DTO
├── user.service.ts             # Service with CRUD logic
└── user.controller.ts          # Controller with REST endpoints
```

### 3. Create a Module

```bash
# Create the module file
cat > apps/my-api/src/app/user/user.module.ts << 'EOF'
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
EOF
```

### 4. Register the Module

Import in your `AppModule`:

```typescript
import { UserModule } from './user/user.module';

@Module({
  imports: [
    // ... other imports
    UserModule,
  ],
})
export class AppModule {}
```

### 5. Use the API

Your CRUD endpoints are ready:

```bash
GET    /user      # List users
GET    /user/:id  # Get user by ID
POST   /user      # Create user
PATCH  /user/:id  # Update user
DELETE /user/:id  # Delete user
```

---

## CLI Reference

### Command Syntax

```bash
ncnu --gen <ModelName> --path <OutputPath> [field:type ...]
```

### Options

| Option | Alias | Required | Description | Example |
|--------|-------|----------|-------------|---------|
| `--gen` | `-g` | Yes | Model name (PascalCase) | `--gen User` |
| `--path` | `-p` | Yes | Output directory path | `--path ./src/app` |
| `[fields]` | - | No | Field definitions | `email:string age:number` |
| `--help` | `-h` | No | Show help message | `--help` |
| `--version` | `-v` | No | Show version | `--version` |

### Field Syntax

Fields are defined as `name:type` pairs:

```bash
ncnu --gen Product --path ./src \
  name:string \
  price:number \
  description:string \
  inStock:boolean \
  releaseDate:date
```

### Naming Conventions

- **Model Name**: PascalCase (e.g., `User`, `BlogPost`, `OrderItem`)
- **Field Names**: camelCase (e.g., `email`, `firstName`, `isActive`)
- **Generated Files**: kebab-case (e.g., `user.entity.ts`, `create-user.dto.ts`)

---

## Field Types Reference

### Supported Types

| Type | TypeScript Type | TypeORM Column Type | Example Values | Notes |
|------|----------------|---------------------|---------------|-------|
| `string` | `string` | `varchar` | `"Hello"`, `"john@example.com"` | General text |
| `number` | `number` | `int` | `42`, `0`, `-10` | Integer values |
| `boolean` | `boolean` | `boolean` | `true`, `false` | Boolean flags |
| `date` | `Date` | `timestamp` | `"2024-01-01"`, `"2024-01-01T10:00:00Z"` | Date/time values |
| `hash` | `string` | `varchar` | `"hashed_value"` | For hashed data (passwords, tokens) |

### Type Examples

```bash
# String fields
ncnu --gen User --path ./src \
  email:string \
  username:string \
  bio:string

# Number fields
ncnu --gen Product --path ./src \
  price:number \
  quantity:number \
  rating:number

# Boolean fields
ncnu --gen Post --path ./src \
  title:string \
  published:boolean \
  featured:boolean

# Date fields
ncnu --gen Event --path ./src \
  title:string \
  startDate:date \
  endDate:date

# Hash fields (for sensitive data)
ncnu --gen User --path ./src \
  email:string \
  password:hash \
  apiKey:hash
```

### Type Mappings

#### String → Varchar
```typescript
// Generated entity
@Column({ type: 'varchar', nullable: true })
name!: string;

// Generated create DTO
@ApiProperty({ required: true })
name!: string;
```

#### Number → Int
```typescript
// Generated entity
@Column({ type: 'int', nullable: true })
age!: number;

// Generated create DTO
@ApiProperty({ required: true })
age!: number;
```

#### Date → Timestamp
```typescript
// Generated entity
@Column({ type: 'timestamp', nullable: true })
birthDate!: Date;

// Generated create DTO
@ApiProperty({ required: true, type: String, format: 'date-time' })
birthDate!: Date;
```

#### Hash → Varchar (for sensitive data)
```typescript
// Generated entity
@Column({ type: 'varchar', nullable: true })
password!: string;  // TypeScript type is string

// Generated create DTO
@ApiProperty({ required: true })
password!: string;
```

---

## Generated Code Structure

### Entity File

**Generated:** `{model}.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id!: number;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  email!: string;

  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  age!: number;
}
```

**Key Features:**
- `@Entity()` decorator for TypeORM
- Auto-generated `id` primary key
- All fields nullable by default
- Swagger `@ApiProperty()` decorators
- Definite assignment assertions (`!`)

### Create DTO

**Generated:** `create-{model}.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ required: true })
  email!: string;

  @ApiProperty({ required: true })
  age!: number;
}
```

**Key Features:**
- All fields required
- Swagger documentation
- Ready for class-validator decorators

### Update DTO

**Generated:** `update-{model}.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  age?: number;
}
```

**Key Features:**
- All fields optional
- Suitable for PATCH requests

### Service File

**Generated:** `{model}.service.ts`

```typescript
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
    repository: Repository<User>,
  ) {
    super({
      repository,
      allowedFilters: [], // Add keys from User to allow filtering
    });
  }
}
```

**Key Features:**
- Extends `NestCrudService`
- Dependency injection setup
- Placeholder for allowed filters (you customize this)

### Controller File

**Generated:** `{model}.controller.ts`

```typescript
import { Controller } from '@nestjs/common';
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('user')
@Controller('user')
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

**Key Features:**
- Extends `CreateNestedCrudController`
- Implements `IBaseController` (prevents TS2742 error)
- Swagger tags
- All CRUD endpoints auto-generated

---

## Usage Examples

### Example 1: Basic User Resource

```bash
ncnu --gen User --path src/app email:string password:hash name:string
```

**Generated structure:**
```
src/app/user/
├── user.entity.ts
├── create-user.dto.ts
├── update-user.dto.ts
├── user.service.ts
└── user.controller.ts
```

### Example 2: Blog Post with Relations

```bash
ncnu --gen Post --path src/app \
  title:string \
  content:string \
  published:boolean \
  publishedAt:date \
  authorId:number
```

Then customize the service for relations:

```typescript
// post.service.ts
super({
  repository,
  allowedFilters: ['title', 'published', 'authorId'],
});
```

### Example 3: E-commerce Product

```bash
ncnu --gen Product --path src/modules \
  name:string \
  description:string \
  price:number \
  quantity:number \
  category:string \
  inStock:boolean \
  sku:string
```

### Example 4: Event Management

```bash
ncnu --gen Event --path src/app \
  title:string \
  description:string \
  startDate:date \
  endDate:date \
  location:string \
  capacity:number \
  isPublic:boolean
```

### Example 5: Multiple Resources at Once

Generate several resources:

```bash
# Generate User
ncnu --gen User --path src/app email:string name:string

# Generate Post
ncnu --gen Post --path src/app title:string content:string authorId:number

# Generate Comment
ncnu --gen Comment --path src/app content:string postId:number authorId:number
```

---

## Integration Workflow

### Complete Project Setup

```bash
# 1. Create NestJS project
nest new my-project
cd my-project

# 2. Install dependencies
pnpm add @nestjs/typeorm typeorm pg
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz

# 3. Install ncnu globally
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz

# 4. Generate resources
ncnu --gen User --path src/app email:string name:string
ncnu --gen Post --path src/app title:string content:string

# 5. Create modules (manually or with script)
# ... create user.module.ts and post.module.ts

# 6. Configure database in app.module.ts

# 7. Run the app
pnpm start:dev
```

### Post-Generation Customization

After generating, you typically want to:

1. **Add Validation** to DTOs:
```typescript
// create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name!: string;
}
```

2. **Configure Filters** in Service:
```typescript
super({
  repository,
  allowedFilters: ['email', 'name'], // Whitelist filterable fields
});
```

3. **Add Relations** to Entity:
```typescript
@ManyToOne(() => User)
@JoinColumn({ name: 'authorId' })
author!: User;
```

4. **Customize Columns**:
```typescript
@Column({ unique: true })
email!: string;

@Column({ select: false })
password!: string;
```

---

## Best Practices

### 1. Use Descriptive Model Names

```bash
# Good
ncnu --gen BlogPost --path src/app
ncnu --gen UserProfile --path src/app
ncnu --gen OrderItem --path src/app

# Avoid
ncnu --gen blog --path src/app
ncnu --gen profile --path src/app
```

### 2. Group Related Resources

```bash
# Organize by feature
ncnu --gen User --path src/modules/auth
ncnu --gen Post --path src/modules/blog
ncnu --gen Product --path src/modules/shop
```

### 3. Customize After Generation

Don't treat generated code as read-only:

```typescript
// Add custom methods to service
async findActiveUsers(): Promise<User[]> {
  return this.repository.find({ where: { isActive: true } });
}

// Add custom endpoints to controller
@Get('active')
async getActive() {
  return this.service.findActiveUsers();
}
```

### 4. Add Validation Immediately

After generation, add validators:

```typescript
import { IsEmail, IsNotEmpty, MinLength, IsNumber, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;
}
```

### 5. Configure Filtering

Whitelist filterable fields in the service:

```typescript
super({
  repository,
  allowedFilters: ['name', 'email', 'isActive'], // Only safe fields
});
```

### 6. Use Environment-Specific Paths

```bash
# Development
ncnu --gen User --path apps/dev-api/src/app

# Production modules
ncnu --gen User --path apps/api/src/modules/users
```

---

## Troubleshooting

### Problem: "command not found: ncnu"

**Solution:** Install globally or use npx:

```bash
# Install globally
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz

# Or use with npx
npx ncnu --gen User --path ./src
```

### Problem: Files Not Generated

**Solution:** Check the output path exists or will be created:

```bash
# ncnu creates directories automatically, but ensure the base path exists
mkdir -p src/app
ncnu --gen User --path src/app email:string
```

### Problem: TypeScript Errors After Generation

**Common issues and fixes:**

1. **Import errors:** Ensure `@nest-util/nest-crud` is installed
```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
```

2. **TypeORM not found:** Install TypeORM
```bash
pnpm add @nestjs/typeorm typeorm
```

3. **Decorator errors:** Install Swagger
```bash
pnpm add @nestjs/swagger
```

### Problem: Generated Code Doesn't Match My Style

**Solution:** ncnu generates opinionated, consistent code. You can:

1. **Customize after generation** - Treat it as a starting point
2. **Create a wrapper script** that post-processes files
3. **Fork and modify** the ncnu package for your needs

### Problem: Want to Regenerate a Resource

ncnu doesn't have a `--force` flag. To regenerate:

```bash
# Option 1: Delete the folder first
rm -rf src/app/user
ncnu --gen User --path src/app email:string

# Option 2: Generate to a different path and compare
ncnu --gen User --path src/temp email:string age:number
# Then manually merge changes
```

---

## Advanced Tips

### Batch Generation Script

Create a script to generate multiple resources:

```bash
#!/bin/bash
# generate-resources.sh

ncnu --gen User --path src/app \
  email:string \
  name:string \
  password:hash

ncnu --gen Post --path src/app \
  title:string \
  content:string \
  authorId:number \
  published:boolean

ncnu --gen Comment --path src/app \
  content:string \
  postId:number \
  authorId:number

echo "Resources generated successfully!"
```

### Modifying Generated Templates

If you need to customize the generator templates, you can fork the `ncnu` package and modify the templates in `libs/ncnu/src/lib/generate.ts`.

---

## Summary

`ncnu` dramatically speeds up NestJS development by:

✅ **Eliminating Boilerplate** - Generate 5 files in seconds  
✅ **Ensuring Consistency** - Same pattern across all resources  
✅ **TypeScript Strict Mode** - Generated code compiles without errors  
✅ **Swagger Ready** - All decorators included  
✅ **Integration Ready** - Works seamlessly with `@nest-util/nest-crud`  

**Common Workflow:**
1. Run `ncnu` to generate files
2. Add validation to DTOs
3. Configure filters in service
4. Create and register module
5. Customize as needed

**Next Steps:**
- [Getting Started Guide](getting-started) - Complete tutorial
- [CRUD Documentation](nest-crud) - Learn about the CRUD system
- [Examples](examples) - See more generation patterns
