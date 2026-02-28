# `@nest-util/nest-crud` Step-by-Step Guide

This guide is for developers who want a **clean, repeatable CRUD foundation** in NestJS with less boilerplate.

You will learn how to:

1. Install dependencies
2. Create your entity + DTOs
3. Set up a service with dependency injection
4. Generate CRUD endpoints using the controller factory
5. Use filtering + pagination
6. Control endpoint exposure and response formatting
7. Apply production best practices

---

## 1) Install dependencies

Install the package and expected runtime dependencies:

```bash
pnpm add @nest-util/nest-crud @nestjs/swagger typeorm class-validator class-transformer
```

> If your project uses npm/yarn, use the equivalent install command.

### Why these packages?

- `@nest-util/nest-crud`: reusable service + controller factory
- `@nestjs/swagger`: API metadata from generated controllers/DTOs
- `typeorm`: repository-based data access
- `class-validator` + `class-transformer`: query/DTO validation and transforms

---

## 2) Create your entity and DTOs

Start with a simple entity and explicit DTOs.

```ts
// post.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ default: false })
  published!: boolean;
}
```

```ts
// create-post.dto.ts
import { IsString } from 'class-validator';

export class CreatePostDto {
  @IsString()
  title!: string;
}
```

```ts
// update-post.dto.ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
```

```ts
// post-response.dto.ts
export class PostResponseDto {
  id!: number;
  title!: string;
  published!: boolean;
}
```

---

## 3) Build your CRUD service (DI setup)

Create a service that extends `NestCrudService` and inject a TypeORM repository.

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { PostResponseDto } from './post-response.dto';

@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto
> {
  constructor(@InjectRepository(Post) repo: Repository<Post>) {
    super({
      repository: repo,
      allowedFilters: ['title', 'published'],
      toResponseDto: (input) => {
        if (Array.isArray(input)) {
          return input.map((post) => ({
            id: post.id,
            title: post.title,
            published: post.published,
          }));
        }

        return {
          id: input.id,
          title: input.title,
          published: input.published,
        };
      },
    });
  }
}
```

### How dependency injection works here

- `@InjectRepository(Post)` injects the `Repository<Post>`.
- You pass the repository into `NestCrudService` via `super({ repository: repo, ... })`.
- The base service handles common operations (`findAll`, `findOne`, `create`, `update`, `remove`).

### Common DI mistakes to avoid

- Forgetting `TypeOrmModule.forFeature([Post])` in the same module scope
- Missing repository in `super(...)` options
- Using filter fields that are not in `allowedFilters`

---

## 4) Create your controller with `CreateNestedCrudController`

Use the factory to generate consistent CRUD endpoints quickly.

```ts
import { Controller } from '@nestjs/common';
import { CreateNestedCrudController } from '@nest-util/nest-crud';
import { PostService } from './post.service';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { PostResponseDto } from './post-response.dto';

@Controller('posts')
export class PostController extends CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto
) {
  constructor(public readonly service: PostService) {
    super(service);
  }
}
```

### Generated endpoints

- `GET /posts`
- `GET /posts/:id`
- `POST /posts`
- `PATCH /posts/:id`
- `DELETE /posts/:id`

---

## 5) Register module imports properly

Make sure your feature module wires everything together:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { PostService } from './post.service';
import { PostController } from './post.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  providers: [PostService],
  controllers: [PostController],
})
export class PostModule {}
```

---

## 6) Filtering and pagination (query usage)

`nest-crud` supports pagination and deep-object filters.

### Pagination examples

```http
GET /posts?page=1&limit=20
```

### Filter examples

```http
GET /posts?filter[title_cont]=nestjs
GET /posts?filter[published_eq]=true
GET /posts?filter[id_gte]=10
```

### Common operators

- `_eq`: equals
- `_cont`: contains
- `_gte`: greater than or equal
- `_lte`: less than or equal

---

## 7) Required app-level setup

For nested query parsing and strong validation, enable these globally:

```ts
app.useGlobalPipes(
  new ValidationPipe({ transform: true, enableImplicitConversion: true })
);
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

> The `query parser = extended` setting is important for `filter[...]` query syntax.

---

## 8) Endpoint control and extension patterns

### Disable selected endpoints

You can selectively disable routes at the service level:

```ts
super({
  repository: repo,
  disabledEndpoints: ['remove'],
});
```

### Add business rules by overriding methods

```ts
async create(dto: CreatePostDto) {
  if (dto.title.length < 5) {
    throw new BadRequestException('Title must be at least 5 characters');
  }

  return super.create(dto);
}
```

This keeps core CRUD behavior while layering business-specific rules safely.

---

## 9) Production best practices

- Keep DTOs explicit and validated
- Restrict `allowedFilters` to safe fields only
- Add indexes to frequently filtered columns
- Use auth guards on CRUD routes where needed
- Keep response mapping (`toResponseDto`) consistent across modules
- Add e2e tests for filters, pagination, and disabled endpoints

---

## 10) Quick troubleshooting

### `filter[...]` query not working

Check:

- Global query parser is set to `extended`
- Your filter key is included in `allowedFilters`
- Operator suffix is valid (`_eq`, `_cont`, `_gte`, `_lte`)

### `404 Resource not found` for an existing route

Check:

- Route wasn’t disabled via `disabledEndpoints`
- ID type matches route expectations (numeric by default)

### Swagger route schema looks wrong

Check:

- Factory arguments are passed in order:
  `CreateNestedCrudController(CreateDto, UpdateDto, ResponseDto)`

---

## 11) Copy/paste starter template

```ts
@Injectable()
export class ResourceService extends NestCrudService<
  Resource,
  CreateDto,
  UpdateDto
> {
  constructor(@InjectRepository(Resource) repo: Repository<Resource>) {
    super({ repository: repo });
  }
}

@Controller('resources')
export class ResourceController extends CreateNestedCrudController(
  CreateDto,
  UpdateDto,
  Resource
) {
  constructor(public readonly service: ResourceService) {
    super(service);
  }
}
```

Use this baseline, then progressively add filters, DTO mapping, auth, and business rules.
