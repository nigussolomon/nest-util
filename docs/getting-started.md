# Getting Started

This guide will walk you through building a complete REST API using `nest-util`. We'll build a simple **Blog API** where users can create posts and comments.

## 1. Project Setup

First, let's create a new NestJS project (if you haven't already):

```bash
# Create a new project
nest new blog-api
cd blog-api

# Install dependencies
pnpm add @nestjs/typeorm typeorm pg @nestjs/swagger class-validator class-transformer
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

Now, install the **nest-util** packages:

```bash
# Install libraries
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-auth-0.0.1.tgz

# Install the code generator globally
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

## 2. Generate Resources

We'll use the `ncnu` CLI to generate our User and Post resources. This will create the Entity, DTOs, Service, and Controller for each.

```bash
# Generate User resource
ncnu --gen User --path src \
  email:string \
  password:hash \
  name:string \
  accessToken:hash \
  refreshToken:hash

# Generate Post resource
ncnu --gen Post --path src \
  title:string \
  content:string \
  published:boolean \
  authorId:number
```

This creates two folders in `src/`: `src/user` and `src/post`, each containing fully functional CRUD components.

## 3. Configure Database & Auth

Open `src/app.module.ts` and configure the database and authentication module.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';
import { UserModule } from './user/user.module'; // You'll need to create this
import { PostModule } from './post/post.module'; // You'll need to create this
// Import auth DTOs (create these or point to existing ones)
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto'; 

@Module({
  imports: [
    // 1. Database Configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'blog_db',
      autoLoadEntities: true,
      synchronize: true, // Don't use in production!
    }),

    // 2. Auth Configuration
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'super-secret-key',
      accessTokenField: 'accessToken',
      refreshTokenField: 'refreshToken',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
    }),

    UserModule,
    PostModule,
  ],
})
export class AppModule {}
```

> **Note:** You'll need to create `UserModule` and `PostModule` files in their respective folders if `ncnu` didn't generate them (it currently generates components, module scaffolding is manual or via `nest g module`).

## 4. Final Polish

To make everything production-ready, update `src/main.ts` with global pipes and Swagger:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation
  app.useGlobalPipes(new ValidationPipe({ 
    transform: true, 
    enableImplicitConversion: true 
  }));

  // Exception Filter
  app.useGlobalFilters(new TypeOrmExceptionFilter());

  // Query Parser for Filtering
  app.getHttpAdapter().getInstance().set('query parser', 'extended');

  // Swagger Docs
  const config = new DocumentBuilder()
    .setTitle('Blog API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
```

## 5. Test It Out!

Start your server:

```bash
pnpm start:dev
```

Visit **http://localhost:3000/api** to see your interactive Swagger documentation.

### Try these requests:

**1. Register a User**
```http
POST /auth/register
{
  "email": "me@example.com",
  "password": "securepassword",
  "name": "My Name"
}
```

**2. Create a Post** (Use the access token from registration)
```http
POST /post
Authorization: Bearer <your_token>
{
  "title": "My First Post",
  "content": "Hello World!",
  "published": true,
  "authorId": 1
}
```

**3. Filter Posts**
```http
GET /post?filter[title_cont]=First&filter[published_eq]=true
```

Congratulations! You've just built a fully documented, secure, and type-safe API in minutes. 🚀
