# Nest Util

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=for-the-badge&logo=typeorm&logoColor=white)

[![CI](https://github.com/nigussolomon/nest-util/actions/workflows/ci.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/ci.yml)
[![Security](https://github.com/nigussolomon/nest-util/actions/workflows/security.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/security.yml)
[![Deploy Documentation](https://github.com/nigussolomon/nest-util/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/deploy-docs.yml)
[![Publish Libs](https://github.com/nigussolomon/nest-util/actions/workflows/publish.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/publish.yml)

**A modern, production-ready collection of NestJS utilities designed to accelerate development by providing reusable, battle-tested patterns for CRUD operations and authentication.**

[Docs Index](./docs/README.md) | [Quick Start](#-quick-start) | [demo-api config](./docs/demo-api/README.md) | [Migration Guide](./MIGRATION-GUIDE.md)

---

## What is Nest-Util?

Nest-Util is a comprehensive toolkit that eliminates boilerplate and accelerates NestJS development. Instead of writing repetitive CRUD logic, authentication flows, and entity scaffolding for every project, Nest-Util provides:

- **Production-Ready Components**: Battle-tested services, controllers, and modules that handle common patterns
- **Flexible Authentication**: Dynamic auth system that adapts to your schema without forcing a specific user model
- **Built-in Best Practices**: Automatic pagination, filtering, hooks, Swagger documentation, and error handling

### Why Nest-Util?

| Problem | Nest-Util Solution |
|---|---|
| Writing the same CRUD logic for every entity | `@nest-util/nest-crud` — Generic CRUD service + controller factory |
| Implementing secure JWT authentication | `@nest-util/nest-auth` — Flexible auth module with token rotation |
| Tracking entity-level mutations | Built-in audit logging via `@Audit()` decorator |
| Inconsistent API responses | Built-in response interceptors and transformers |
| Manual Swagger documentation | Automatic OpenAPI documentation with proper decorators |

---

## Architecture Overview

Nest-Util is composed of focused modules that integrate into the same NestJS app.

**Architecture Components:**

- `@nest-util/nest-crud`: provides reusable CRUD service/controller building blocks, audit logging, lifecycle hooks, cursor pagination, and findMine
- `@nest-util/nest-auth`: handles JWT auth, refresh tokens, and permissions
- `TypeORM + Database`: persistence layer used by all runtime modules

### Integration Flow

1. Configure TypeORM and entity loading.
2. Add `AuthModule.forRoot(...)`.
3. Build services with `NestCrudService`.
4. Build controllers with `CreateNestedCrudController(...)`.
5. Configure `main.ts` globals (validation pipe, query parser, Swagger, DB exception filter).

---

## Key Features

### 1. @nest-util/nest-crud

A powerful and flexible CRUD library featuring:

- **`NestCrudService`**: Generic base service for common TypeORM operations with built-in filtering and pagination
- **`CreateNestedCrudController`**: Controller factory that generates fully-functional REST endpoints
- **`IBaseController`**: TypeScript interface for proper type inference
- **Advanced Filtering**: Query-based filtering with operators like `eq`, `cont`, `gte`, `lte`
- **Pagination**: Both offset-based (`page`/`limit`) and cursor-based (`?cursor=...`)
- **Lifecycle Hooks**: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeRemove`, `afterRemove`, `beforeFindOne`, `afterFindOne` — with optional transaction wrapping
- **findMine**: User-scoped record retrieval via `GET /resource/mine` with `@CurrentUser()` injection
- **Audit Logging**: Built-in `@Audit()` decorator and `AuditInterceptor` for entity-level mutation tracking
- **Swagger Integration**: Automatic OpenAPI documentation with proper schemas
- **Response Interceptors**: Consistent API response format with metadata

**Key Capabilities:**

- Type-safe CRUD operations
- Dynamic query filtering (`?filter[name_cont]=john&filter[age_gte]=18`)
- Cursor pagination for efficient large-dataset traversal
- Before/after hooks with configurable transaction isolation levels
- User-scoped record retrieval (`GET /resource/mine`)
- Automatic Swagger documentation
- Global exception handling for database errors
- Extensible architecture for custom business logic

### 2. @nest-util/nest-auth

A dynamic and flexible authentication library:

- **`AuthModule`**: Dynamic configuration for entities, fields, and JWT settings
- **`AuthService`**: Built-in registration and login with bcrypt hashing
- **Token Security**: Refresh token rotation with nonce-based validation
- **Custom Decorators**: `@Public()`, `@CurrentUser()`, `@AuthOptions()`
- **Flexible DTOs**: Bring your own DTOs for full control over validation and documentation
- **Route Control**: Enable/disable auth endpoints via configuration

**Security Features:**

- JWT access and refresh token rotation
- Bcrypt password hashing
- Single-use refresh tokens with nonce validation
- Automatic token invalidation on refresh
- No sensitive data in auth responses
- Configurable token expiration

---

## Installation

### Prerequisites

- **Node.js**: v18 or higher
- **pnpm** (recommended) or npm
- **PostgreSQL** (or your preferred database)
- **NestJS**: v10+
- **TypeORM**: v1.1.0+

### Installing Libraries

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^1.0.6 @nest-util/nest-auth@^1.0.2 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

---

## Quick Start

### Step 1: Register the Module

Create a module for your resource:

```typescript
// apps/my-api/src/app/post/post.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from './post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
```

Import it in your `AppModule`:

```typescript
import { PostModule } from './post/post.module';

@Module({
  imports: [
    // ... other imports
    PostModule,
  ],
})
export class AppModule {}
```

### Step 2: Configure Global Settings

For optimal functionality, add these global configurations in your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      enableImplicitConversion: true,
    })
  );

  app.useGlobalFilters(new TypeOrmExceptionFilter());

  const adapter = app.getHttpAdapter();
  adapter.getInstance().set('query parser', 'extended');

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}
bootstrap();
```

### Step 3: Test Your API

Your CRUD endpoints are now available:

```bash
# Create a post
curl -X POST http://localhost:3000/post \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","content":"World","published":true}'

# Get all posts with pagination
curl "http://localhost:3000/post?page=1&limit=10"

# Filter posts
curl "http://localhost:3000/post?filter[published_eq]=true&filter[title_cont]=Hello"

# Cursor pagination
curl "http://localhost:3000/post?cursor=eyJpZCI6MTB9&limit=10"

# Get one post
curl http://localhost:3000/post/1

# Update a post
curl -X PATCH http://localhost:3000/post/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# Delete a post
curl -X DELETE http://localhost:3000/post/1
```

Visit `http://localhost:3000/api/docs` for interactive Swagger documentation!

---

## Adding Authentication

### Step 1: Configure AuthModule

```typescript
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto';

@Module({
  imports: [
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      accessTokenField: 'accessToken',
      refreshTokenField: 'refreshToken',
    }),
  ],
})
export class AppModule {}
```

### Step 2: Protect Routes

```typescript
import { JwtAuthGuard, CurrentUser, AuthUser } from '@nest-util/nest-auth';

@Controller('post')
@UseGuards(JwtAuthGuard)
export class PostController
  extends CreateNestedCrudController(CreatePostDto, UpdatePostDto, Post)
  implements IBaseController<CreatePostDto, UpdatePostDto, Post>
{
  constructor(override readonly service: PostService) {
    super(service);
  }

  @Get('my-posts')
  getMyPosts(@CurrentUser() user: AuthUser) {
    return this.service.findAll({ filter: { authorId_eq: user.id } });
  }
}
```

---

## Development

This workspace uses [Nx](https://nx.dev) for efficient monorepo management.

### Repository Setup

```bash
# Clone the repository
git clone https://github.com/nigussolomon/nest-util.git
cd nest-util

# Install dependencies
pnpm install

# Start the database (PostgreSQL via Docker)
./db.sh

# Run the demo API
npx nx serve demo-api
```

Explore the demo API at `http://localhost:3000/api/docs`

### Useful Commands

```bash
# View dependency graph
npx nx graph

# Lint a specific library
npx nx lint nest-crud

# Build all libraries
npx nx run-many -t build

# Run tests for a library
npx nx test nest-crud

# Run affected tests (only projects affected by changes)
npx nx affected -t test

# Type check all projects
npx nx run-many -t typecheck
```

---

## Advanced Features

### Custom Filtering

The CRUD system supports advanced filtering with various operators:

```typescript
// Filter by exact match
GET /post?filter[published_eq]=true

// Filter by contains (case-insensitive)
GET /post?filter[title_cont]=hello

// Filter by greater than or equal
GET /post?filter[views_gte]=100

// Filter by less than or equal
GET /post?filter[createdAt_lte]=2024-01-01

// Combine multiple filters
GET /post?filter[published_eq]=true&filter[views_gte]=100&filter[title_cont]=nest

// OR groups (requires `query parser = extended`)
GET /post?filter[or][0][title_cont]=nestjs&filter[or][1][title_cont]=typeorm
```

**Supported Operators:** `eq`, `ne`, `cont`, `notcont`, `starts`, `ends`, `gte`, `lte`, `gt`, `lt`, `in`, `nin`, `isnull`

**Grouping Keys:** `and`, `or`

### Lifecycle Hooks

Add before/after hooks with optional transaction wrapping:

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      hooks: {
        beforeCreate: {
          handler: async (ctx) => {
            ctx.payload.title = ctx.payload.title.trim();
          },
          transaction: true,
        },
        afterCreate: {
          handler: async (ctx) => {
            await this.notificationService.notify('post.created', ctx.entity);
          },
        },
      },
      transactionConfig: {
        isolationLevel: 'READ COMMITTED',
      },
    });
  }
}
```

### Cursor Pagination

```bash
# First page
GET /posts?limit=10

# Next page (use nextCursor from previous response)
GET /posts?cursor=eyJpZCI6MTB9&limit=10

# With total count
GET /posts?limit=10&includeTotal=true
```

### findMine (User-Scoped Records)

```typescript
// Service
super({
  repository,
  userOwnershipField: 'authorId',
});

// Controller
CreateNestedCrudController(CreatePostDto, UpdatePostDto, Post, {
  enableFindMine: true,
});
```

---

## Troubleshooting

### TypeScript Error: TS2742 (Inferred type is not portable)

**Solution:** Add explicit `implements IBaseController` to your controller:

```typescript
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';

export class MyController
  extends CreateNestedCrudController(CreateDto, UpdateDto, ResponseDto)
  implements IBaseController<CreateDto, UpdateDto, ResponseDto> {
  // ...
}
```

### Database Connection Issues

Ensure your `TypeOrmModule` is properly configured:

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'mydb',
  autoLoadEntities: true,  // Required for AuditLogEntity
  synchronize: process.env.NODE_ENV !== 'production',
});
```

### Filtering Not Working

Make sure you've configured the query parser correctly:

```typescript
const adapter = app.getHttpAdapter();
adapter.getInstance().set('query parser', 'extended');
```

And whitelist fields in your service:

```typescript
super({
  repository,
  allowedFilters: ['name', 'email', 'status'],
});
```

### Authentication Token Issues

Check that:

1. Your user entity has `accessToken` and `refreshToken` fields
2. JWT secret is consistent across requests
3. Token fields are excluded from default queries (add `select: false` in entity)

```typescript
@Column({ select: false })
refreshToken?: string;
```

---

## Documentation

- **Docs Index**: [docs/README.md](./docs/README.md)
- **demo-api setup**: [docs/demo-api/README.md](./docs/demo-api/README.md)
- **nest-auth guide**: [docs/nest-auth/README.md](./docs/nest-auth/README.md)
- **nest-crud guide**: [docs/nest-crud/README.md](./docs/nest-crud/README.md)
- **Migration Guide**: [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

> **Tip:** Start from [docs/README.md](./docs/README.md). The module guides are split by package and include demo-api-specific configuration notes.
