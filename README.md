# Nest Util

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=for-the-badge&logo=typeorm&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)

**A modern, production-ready collection of NestJS utilities designed to accelerate development by providing reusable, battle-tested patterns for CRUD operations, authentication, and rapid code generation.**

📖 **[View Full Documentation](https://nigussolomon.github.io/nest-util/guide.html#/)** | 🚀 **[Quick Start](#-quick-start)** | 💡 **[Examples](https://nigussolomon.github.io/nest-util/guide.html#/examples)**

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
| Manually scaffolding entities, DTOs, services | `ncnu` - Code generator with smart type mapping                      |
| Implementing secure JWT authentication        | `@nest-util/nest-auth` - Flexible auth module with token rotation    |
| Inconsistent API responses                    | Built-in response interceptors and transformers                      |
| Manual Swagger documentation                  | Automatic OpenAPI documentation with proper decorators               |

---

## 🏗️ Architecture Overview

Nest-Util is composed of four core packages plus a CLI that work together seamlessly:

```
┌─────────────────────────────────────────────────────────┐
│                     Your NestJS App                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   ncnu CLI  │  │  nest-crud   │  │  nest-auth    │  │
│  │  nest-file  │  │              │  │               │  │
│  │  Generator  │  │   Library    │  │   Library     │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│        │                  │                   │          │
│        │                  │                   │          │
│        ▼                  ▼                   ▼          │
│  Generates Code ───> Uses CRUD ────> Secures Routes     │
│                      Components      with Auth          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  TypeORM + DB    │
              └──────────────────┘
```

**Typical Workflow:**

1. Use `ncnu` to generate entities, DTOs, services, and controllers
2. Generated code automatically extends `NestCrudService` and `CreateNestedCrudController`
3. Add `@nest-util/nest-auth` for authentication on protected routes
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

### 2. 🛠️ ncnu (NestJS CRUD Generator)

A professional code generation CLI tool to scaffold your NestJS resources:

- **Rapid Prototyping**: Generate Entity, Service, Controller, and DTOs in seconds
- **Smart Type Mapping**: Automatically handles TypeORM column types and Swagger decorators
- **Definite Assignment**: Generates code compatible with strict TypeScript property initialization
- **Organized Structure**: Creates dedicated folders with all necessary files
- **Production Ready**: Generated code includes proper imports, decorators, and type annotations

**What Gets Generated:**

- `{model}.entity.ts` - TypeORM entity with proper column decorators
- `create-{model}.dto.ts` - DTO for creation with validation decorators
- `update-{model}.dto.ts` - DTO for updates with optional fields
- `{model}.service.ts` - Service extending `NestCrudService`
- `{model}.controller.ts` - Controller extending `CreateNestedCrudController`

### 3. 🔐 @nest-util/nest-auth

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


### 4. 🗂️ @nest-util/nest-file

A secure encrypted file storage module for NestJS + TypeORM: 

- **`NestFileModule`**: Dynamic module with `forRoot` and `forRootAsync` support
- **`StoredFileService`**: Upload, download, list, and delete operations
- **`StoredFileEntity`**: PostgreSQL metadata model with owner attachment (`ownerType`, `ownerId`)
- **MinIO Storage**: Encrypted object storage for binary payloads
- **Encryption**: AES-256-GCM encryption with integrity verification

**File Security Features:**

- ✅ Encrypted-at-rest object payloads
- ✅ SHA-256 integrity digest verification on reads
- ✅ File-to-entity attachment via owner references
- ✅ MinIO bucket auto-creation option
- ✅ TypeORM/Postgres metadata indexing

---

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

# Install nest-file library
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-file-0.0.1.tgz

# Required peer/runtime dependencies
pnpm add @nestjs/typeorm typeorm @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt minio
pnpm add -D @types/passport-jwt @types/bcrypt
```

### Installing the Code Generator

Install `ncnu` globally for easy access:

```bash
# Global installation
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz

# Verify installation
ncnu --help
```

Alternatively, use with `npx`:

```bash
npx https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz --gen User --path ./src/app email:string
```

---

## ⚡ Quick Start

### Step 1: Generate Your First Resource

Use the `ncnu` CLI to scaffold a complete CRUD resource:

```bash
ncnu --gen Post --path apps/my-api/src/app \
  title:string \
  content:string \
  published:boolean \
  publishedAt:date \
  authorId:number
```

This generates:

```
apps/my-api/src/app/post/
├── post.entity.ts
├── create-post.dto.ts
├── update-post.dto.ts
├── post.service.ts
└── post.controller.ts
```

### Step 2: Register the Module

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

### Step 1: Generate User Entity

```bash
ncnu --gen User --path apps/my-api/src/app \
  email:string \
  password:hash \
  accessToken:hash \
  refreshToken:hash
```

### Step 2: Configure AuthModule

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
```

**Supported Operators:**

- `eq` - Equals
- `cont` - Contains (case-insensitive)
- `gte` - Greater than or equal
- `lte` - Less than or equal

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

> **Note:** The `ncnu` generator automatically includes this fix in generated code.

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

- **Full Documentation**: [nigussolomon.github.io/nest-util](https://nigussolomon.github.io/nest-util/guide.html#/)
- **Getting Started Guide**: [Getting Started](https://nigussolomon.github.io/nest-util/guide.html#/getting-started)
- **API Reference**: [API Documentation](https://nigussolomon.github.io/nest-util/guide.html#/api-reference)
- **Examples**: [Real-World Examples](https://nigussolomon.github.io/nest-util/guide.html#/examples)
- **Troubleshooting**: [Common Issues](https://nigussolomon.github.io/nest-util/guide.html#/troubleshooting)

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

> [!TIP] > **GitHub Pages**: Detailed documentation is automatically deployed to GitHub Pages on every push to the `main` branch. Check it out at [nigussolomon.github.io/nest-util](https://nigussolomon.github.io/nest-util/guide.html#/).
