# nest-crud Setup Guide

This guide reflects the implementation in `libs/nest-crud`.

## 1) Install

```bash
pnpm add @nest-util/nest-crud @nest-util/nest-audit
```

`nest-crud` integrates with `nest-audit` (`@Audit` and audit-log endpoint support).

## 2) Build a Service with `NestCrudService`

Create your resource service by extending `NestCrudService`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title'],
      include: ['author'],
      disabledEndpoints: [],
    });
  }
}
```

## 3) Build a Controller with `CreateNestedCrudController`

```ts
import { Controller, UseGuards } from '@nestjs/common';
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  PermissionsGuard,
  buildCrudPermissionsFromRegistry,
} from '@nest-util/nest-auth';

const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, {
      resource: 'posts',
    }),
  }
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

@ApiTags('post')
@Controller('post')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

## 4) Available CRUD Endpoints

Generated controller includes:

- `GET /resource` (with `page`, `limit`, `filter[...]`)
- `GET /resource/:id`
- `POST /resource`
- `PATCH /resource/:id`
- `DELETE /resource/:id`
- `GET /resource/auditlogs` (if `service.findAuditLogs` exists)

## 5) Global Response and DB Error Handling

Add these in bootstrap:

- `ResponseInterceptor` as global interceptor for consistent response shape.
- `TypeOrmExceptionFilter` as global filter for DB errors (including duplicate keys).

## 6) Filtering and Pagination Notes

- Filtering uses `filter[field_operator]=value` format.
- Supported operators in docs/examples: `eq`, `cont`, `gte`, `lte`.
- Express query parser should be `extended` for deep object query parsing.

## 7) Help Notes

- Use `disabledEndpoints` in service options to hide generated routes without rewriting controllers.
- `relations` option lets you resolve `propertyId` payload fields into related entities.
- If `findAuditLogs` is not implemented in service, `/auditlogs` returns not found by design.
