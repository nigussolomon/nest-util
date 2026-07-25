# Nest Util

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=for-the-badge&logo=typeorm&logoColor=white)

[![CI](https://github.com/nigussolomon/nest-util/actions/workflows/ci.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/ci.yml)
[![Security](https://github.com/nigussolomon/nest-util/actions/workflows/security.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/security.yml)
[![Deploy Documentation](https://github.com/nigussolomon/nest-util/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/deploy-docs.yml)
[![Publish Libs](https://github.com/nigussolomon/nest-util/actions/workflows/publish.yml/badge.svg)](https://github.com/nigussolomon/nest-util/actions/workflows/publish.yml)

**A modern, production-ready collection of NestJS utilities designed to accelerate development by providing reusable, battle-tested patterns for CRUD operations, authentication, and rapid code generation.**

📖 **[Docs Index](./docs/README.md)** | 🚀 **[Quick Start](#-quick-start)** | ⚙️ **[demo-api config](./docs/demo-api/README.md)**

---

## 🎯 What is Nest-Util?

Nest-Util is a comprehensive toolkit that eliminates boilerplate and accelerates NestJS development. Instead of writing repetitive CRUD logic, authentication flows, and entity scaffolding for every project, Nest-Util provides:

- **Production-Ready Components**: Battle-tested services, controllers, and modules that handle common patterns
- **Type-Safe Code Generation**: CLI tool that generates fully-typed entities, DTOs, services, and controllers
- **Flexible Authentication**: Dynamic auth system that adapts to your schema without forcing a specific user model
- **Built-in Best Practices**: Automatic pagination, filtering, Swagger documentation, and error handling

### Why Nest-Util?

| Problem                                       | Nest-Util Solution                                                   |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Writing the same CRUD logic for every entity  | `@nest-util/nest-crud` - Generic CRUD service and controller factory |
| Implementing secure JWT authentication        | `@nest-util/nest-auth` - Flexible auth module with token rotation    |
| Tracking entity-level mutations               | `@nest-util/nest-audit` - Audit logs for create/update/delete flows  |
| Inconsistent API responses                    | Built-in response interceptors and transformers                      |
| Manual Swagger documentation                  | Automatic OpenAPI documentation with proper decorators               |

---

## 🏗️ Architecture Overview

Nest-Util is composed of focused modules that integrate into the same NestJS app.

**Architecture Components:**

- `@nest-util/nest-crud`: provides reusable CRUD service/controller building blocks
- `@nest-util/nest-auth`: handles JWT auth, refresh tokens, and permissions
- `@nest-util/nest-audit`: records audit events for mutating operations
- `TypeORM + Database`: persistence layer used by all runtime modules

### Integration Flow

1. Configure TypeORM and entity loading.
2. Add `NestUtilNestAuditModule`.
3. Add `AuthModule.forRoot(...)`.
4. Build services with `NestCrudService`.
5. Build controllers with `CreateNestedCrudController(...)`.
6. Configure `main.ts` globals (validation pipe, query parser, Swagger, DB exception filter).

**Typical Workflow:**

1. Build services extending `NestCrudService` and controllers extending `CreateNestedCrudController`
2. Add `@nest-util/nest-auth` for authentication on protected routes
3. Enable `@nest-util/nest-audit` interceptor for mutation logging
4. Get automatic pagination, filtering, Swagger docs, and error handling

---

## 🚀 Key Features

### 1. 📦 @nest-util/nest-crud

A powerful and flexible CRUD library featuring:

- **`NestCrudService`**: Generic base service for common TypeORM operations with built-in filtering and pagination
- **`CreateNestedCrudController`**: Controller factory that generates fully-functional REST endpoints
- **`IBaseController`**: TypeScript interface for proper type inference
- **Advanced Filtering**: Query-based filtering with operators like `eq`, `cont`, `gte`, `lte`
- **Automatic Pagination**: Out-of-the-box support for page-based and limit-offset pagination
- **Swagger Integration**: Automatic OpenAPI documentation with proper schemas
- **Response Interceptors**: Consistent API response format with metadata

**Key Capabilities:**

- ✅ Type-safe CRUD operations
- ✅ Dynamic query filtering (`?filter[name_cont]=john&filter[age_gte]=18`)
- ✅ Automatic Swagger documentation
- ✅ Global exception handling for database errors
- ✅ Extensible architecture for custom business logic

### 2. 🔐 @nest-util/nest-auth

A dynamic and flexible authentication library:

- **`AuthModule`**: Dynamic configuration for entities, fields, and JWT settings
- **`AuthService`**: Built-in registration and login with bcrypt hashing
- **Token Security**: Refresh token rotation with nonce-based validation
- **Custom Decorators**: `@Public()`, `@CurrentUser()`, `@AuthOptions()`
- **Flexible DTOs**: Bring your own DTOs for full control over validation and documentation
- **Route Control**: Enable/disable auth endpoints via configuration

**Security Features:**

- ✅ JWT access and refresh token rotation
- ✅ Bcrypt password hashing
- ✅ Single-use refresh tokens with nonce validation
- ✅ Automatic token invalidation on refresh
- ✅ No sensitive data in auth responses
- ✅ Configurable token expiration

## 🛠️ Installation

### Prerequisites

- **Node.js**: v18 or higher
- **pnpm** (recommended) or npm
- **PostgreSQL** (or your preferred database)
- **NestJS**: v10+
- **TypeORM**: v0.3+

### Installing Libraries

Install the packages directly from GitHub releases:

```bash
# Install nest-crud library
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz

# Install nest-auth library
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-auth-0.0.1.tgz

# Required peer/runtime dependencies
pnpm add @nestjs/typeorm typeorm @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

---

## ⚡ Quick Start

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

### Step 3: Configure Global Settings

For optimal functionality, add these global configurations in your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable transformation and validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      enableImplicitConversion: true,
    })
  );

  // Handle database errors gracefully
  app.useGlobalFilters(new TypeOrmExceptionFilter());

  // Configure query parser for complex filtering
  const adapter = app.getHttpAdapter();
  adapter.getInstance().set('query parser', 'extended');

  // Setup Swagger documentation
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

### Step 4: Test Your API

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

## 🔐 Adding Authentication

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

### Step 3: Protect Routes

```typescript
import { JwtAuthGuard, CurrentUser, AuthUser } from '@nest-util/nest-auth';

@Controller('post')
@UseGuards(JwtAuthGuard) // Protect all routes
export class PostController
  extends CreateNestedCrudController(CreatePostDto, UpdatePostDto, Post)
  implements IBaseController<CreatePostDto, UpdatePostDto, Post>
{
  constructor(override readonly service: PostService) {
    super(service);
  }

  // Access current user in custom endpoints
  @Get('my-posts')
  getMyPosts(@CurrentUser() user: AuthUser) {
    return this.service.findAll({ filter: { authorId_eq: user.id } });
  }
}
```

Authentication endpoints are now available:

- `POST /auth/register` - Create new user
- `POST /auth/login` - Login and get tokens
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user profile
- `POST /auth/logout` - Logout (invalidate tokens)

---

## 🧑‍💻 Development

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

## 📚 Advanced Features

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

// Nested group with advanced operators
GET /post?filter[and][0][status_ne]=archived&filter[and][1][views_in]=100,200,300
```

> For nested keys like `filter[or][0][title_cont]`, set Express query parsing to extended mode:
> `app.getHttpAdapter().getInstance().set('query parser', 'extended')`.

**Supported Operators:**

- `eq` - Equals
- `ne` - Not equals
- `cont` - Contains (case-insensitive)
- `notcont` - Does not contain (case-insensitive)
- `starts` - Starts with (case-insensitive)
- `ends` - Ends with (case-insensitive)
- `gte` - Greater than or equal
- `lte` - Less than or equal
- `gt` - Greater than
- `lt` - Less than
- `in` - Matches any value from a comma-separated list
- `nin` - Does not match values from a comma-separated list
- `isnull` - `true` for `IS NULL`, `false` for `IS NOT NULL`

**Grouping Keys:**

- `and` - Combine nested filters with AND
- `or` - Combine nested filters with OR

### Extending CRUD Services

Add custom business logic while keeping CRUD functionality:

```typescript
@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title', 'published', 'authorId'], // Whitelist filterable fields
    });
  }

  // Add custom methods
  async findPublished(): Promise<Post[]> {
    return this.repository.find({ where: { published: true } });
  }

  async publishPost(id: number): Promise<Post> {
    const post = await this.findOne(id);
    return this.update(id, { published: true, publishedAt: new Date() } as any);
  }
}
```

### Custom Controller Endpoints

Mix generated CRUD endpoints with custom routes:

```typescript
@Controller('post')
export class PostController
  extends CreateNestedCrudController(CreatePostDto, UpdatePostDto, Post)
  implements IBaseController<CreatePostDto, UpdatePostDto, Post>
{
  constructor(override readonly service: PostService) {
    super(service);
  }

  // Add custom endpoints alongside CRUD routes
  @Get('published')
  @Message('fetched published posts')
  async getPublished() {
    return this.service.findPublished();
  }

  @Post(':id/publish')
  @Message('published')
  async publish(@Param('id', ParseIntPipe) id: number) {
    return this.service.publishPost(id);
  }
}
```

---

## 🐛 Troubleshooting

### TypeScript Error: TS2742 (Inferred type is not portable)

**Error:**

```
The inferred type of 'MyController' cannot be named without a reference to
'../node_modules/@nestjs/common'. This is likely not portable.
```

**Solution:**
Add explicit `implements IBaseController` to your controller:

```typescript
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';

export class MyController
  extends CreateNestedCrudController(CreateDto, UpdateDto, ResponseDto)
  implements IBaseController<CreateDto, UpdateDto, ResponseDto> {
  // ...
}
```

> **Note:** The generated controller pattern above is the recommended approach for strict TypeScript.

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
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production', // Disable in production!
});
```

### Filtering Not Working

Make sure you've configured the query parser correctly:

```typescript
// In main.ts
const adapter = app.getHttpAdapter();
adapter.getInstance().set('query parser', 'extended');
```

And whitelist fields in your service:

```typescript
super({
  repository,
  allowedFilters: ['name', 'email', 'status'], // Only these fields can be filtered
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

## 📖 Documentation

- **Docs Index**: [docs/README.md](./docs/README.md)
- **demo-api setup**: [docs/demo-api/README.md](./docs/demo-api/README.md)
- **nest-auth guide**: [docs/nest-auth/README.md](./docs/nest-auth/README.md)
- **nest-crud guide**: [docs/nest-crud/README.md](./docs/nest-crud/README.md)
- **nest-audit guide**: [docs/nest-audit/README.md](./docs/nest-audit/README.md)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🌟 Show Your Support

If this project helped you, please give it a ⭐ on [GitHub](https://github.com/nigussolomon/nest-util)!

---

> [!TIP]
> Start from [docs/README.md](./docs/README.md). The module guides are split by package and include demo-api-specific configuration notes.
