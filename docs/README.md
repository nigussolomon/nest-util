# Nest-Util Documentation

> A modern, production-ready collection of NestJS utilities for rapid application development

Nest-Util is a comprehensive toolkit that eliminates boilerplate and accelerates NestJS development by providing battle-tested components for CRUD operations, authentication, and code generation.

## 🎯 What is Nest-Util?

Nest-Util consists of three integrated packages that work seamlessly together:

### 📦 @nest-util/nest-crud
A powerful CRUD library that provides generic services and controllers for TypeORM entities with automatic pagination, filtering, and Swagger documentation.

**[Read Complete Guide →](nest-crud)**

### 🛠️ ncnu (CLI Generator)
A professional code generation tool that scaffolds complete CRUD resources (entities, DTOs, services, controllers) with smart type mapping and proper decorators.

**[Read Complete Guide →](ncnu)**

### 🔐 @nest-util/nest-auth
A flexible authentication module with JWT support, refresh token rotation, and dynamic entity mapping that adapts to your schema.

**[Read Complete Guide →](nest-auth)**

---

## 🏗️ How It Works

```mermaid
graph TB
    A[Your NestJS App] --> B[ncnu CLI Generator]
    B -->|Generates| C[Entity + DTOs]
    B -->|Generates| D[Service extends NestCrudService]
    B -->|Generates| E[Controller extends CreateNestedCrudController]
    
    C --> F[TypeORM Database]
    D --> F
    E --> D
    
    E --> G[REST API Endpoints]
    G -->|Protected by| H[@nest-util/nest-auth]
    
    G --> I[Automatic Swagger Docs]
    G --> J[Pagination & Filtering]
    G --> K[Consistent Responses]
    
    style A fill:#e1f5fe
    style B fill:#fff3e0
    style H fill:#f3e5f5
    style I fill:#e8f5e9
    style J fill:#e8f5e9
    style K fill:#e8f5e9
```

**Typical workflow:**
1. Use `ncnu` to generate resources
2. Generated code automatically extends CRUD components
3. Add authentication with `@nest-util/nest-auth`
4. Get automatic API documentation, filtering, and pagination

---

## ⚡ Quick Start

### 1. Install Packages

```bash
# Install the CRUD library
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz

# Install the generator
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

### 2. Generate a Resource

```bash
ncnu --gen Post --path src/app title:string content:string published:boolean
```

### 3. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post/post.controller';
import { PostService } from './post/post.service';
import { Post } from './post/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
```

### 4. Configure Global Settings

```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ 
    transform: true, 
    enableImplicitConversion: true 
  }));

  app.useGlobalFilters(new TypeOrmExceptionFilter());

  app.getHttpAdapter().getInstance().set('query parser', 'extended');

  await app.listen(3000);
}
bootstrap();
```

### 5. Use Your API

Your CRUD endpoints are now available:

```bash
# Create
POST /post {"title":"Hello","content":"World"}

# List with pagination
GET /post?page=1&limit=10

# Filter
GET /post?filter[published_eq]=true

# Get one
GET /post/1

# Update
PATCH /post/1 {"title":"Updated"}

# Delete
DELETE /post/1
```

**📖 [Full Getting Started Guide →](getting-started)**

---

## 🌟 Key Features

### Type-Safe CRUD Operations
- Generic services and controllers
- Full TypeScript support
- Automatic type inference

### Advanced Filtering
```bash
# Equals
GET /posts?filter[published_eq]=true

# Contains (case-insensitive)
GET /posts?filter[title_cont]=nest

# Greater than or equal
GET /posts?filter[views_gte]=100

# Combine filters
GET /posts?filter[published_eq]=true&filter[views_gte]=100
```

### Automatic Pagination
```bash
GET /posts?page=1&limit=20
```

### Swagger Integration
Automatic OpenAPI documentation for all endpoints with proper schemas, examples, and validation rules.

### Flexible Authentication
- JWT access and refresh tokens
- Token rotation with nonce validation
- Configurable field mapping
- Custom DTOs for full control

---

## 📚 Documentation Structure

### Core Components
- **[CRUD System](nest-crud)** - Complete guide to `NestCrudService` and `CreateNestedCrudController`
- **[Authentication](nest-auth)** - Flexible JWT authentication with token rotation
- **[Code Generator](ncnu)** - CLI tool for scaffolding resources

### Guides
- **[Getting Started](getting-started)** - Step-by-step tutorial for new projects
- **[Architecture](architecture)** - System design and component interaction
- **[Examples](examples)** - Real-world use cases and patterns
- **[Troubleshooting](troubleshooting)** - Common issues and solutions
- **[API Reference](api-reference)** - Complete API documentation

---

## 🎓 Learning Path

**For beginners:**
1. Read [Getting Started](getting-started)
2. Follow the [CRUD Guide](nest-crud)
3. Explore [Examples](examples)

**For experienced developers:**
1. Review [Architecture](architecture)
2. Check [API Reference](api-reference)
3. Read advanced topics in each component guide

---

## 💡 Use Cases

### Rapid Prototyping
Quickly scaffold a complete REST API with CRUD operations, pagination, filtering, and documentation.

### Production APIs
Build scalable, maintainable APIs with consistent patterns and proper separation of concerns.

### Microservices
Create standardized CRUD services across multiple microservices with shared utilities.

### Internal Tools
Build admin panels and internal tools with minimal boilerplate.

---

## 🔧 Global Configuration

For optimal functionality, configure these global settings in your application:

### ValidationPipe
Automatically transform and validate request payloads:
```typescript
app.useGlobalPipes(new ValidationPipe({ 
  transform: true, 
  enableImplicitConversion: true 
}));
```

### TypeOrmExceptionFilter
Gracefully handle database-specific errors:
```typescript
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
app.useGlobalFilters(new TypeOrmExceptionFilter());
```

### Query Parser
Handle complex nested query strings for filtering:
```typescript
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

### Swagger Documentation
Generate interactive API documentation:
```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('My API')
  .setDescription('API documentation')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
  
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

## 🤝 Contributing

Contributions are welcome! Visit our [GitHub repository](https://github.com/nigussolomon/nest-util) to:
- Report issues
- Submit pull requests
- Suggest features
- Improve documentation

---

## 📖 Resources

- **GitHub**: [github.com/nigussolomon/nest-util](https://github.com/nigussolomon/nest-util)
- **Issues**: [Report a bug or request a feature](https://github.com/nigussolomon/nest-util/issues)
- **Releases**: [Download packages](https://github.com/nigussolomon/nest-util/releases)

---

## 🎯 Next Steps

- **[Getting Started Guide](getting-started)** - Build your first application
- **[CRUD Documentation](nest-crud)** - Learn about the CRUD system
- **[Authentication Guide](nest-auth)** - Secure your API
- **[Examples](examples)** - See real-world implementations
