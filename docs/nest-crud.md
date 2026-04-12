# `@nest-util/nest-crud`

`nest-crud` provides reusable CRUD foundations for TypeORM-based NestJS modules.

## Core exports

- `NestCrudService<T>`
- `CreateNestedCrudController<T, CreateDto, UpdateDto>()`
- `TypeOrmExceptionFilter`
- filter/pagination DTO helpers
- response decorators/interceptors

---

## Service pattern

Extend the base service with your entity repository:

```ts
@Injectable()
export class PostService extends NestCrudService<Post> {
  constructor(@InjectRepository(Post) repo: Repository<Post>) {
    super(repo, Post);
  }
}
```

### Common inherited capabilities

- Create entity from DTO
- Find one/many entities
- Filter and paginate list responses
- Update and delete operations
- Consistent error handling surface

---

## Controller factory pattern

```ts
@Controller('posts')
export class PostController extends CreateNestedCrudController(
  Post,
  CreatePostDto,
  UpdatePostDto
) {
  constructor(public readonly service: PostService) {
    super(service);
  }
}
```

### Integrate with `PermissionsGuard` (no method overrides)

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('posts')
export class PostController extends CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto,
  {
    permissions: {
      findAll: 'posts.read',
      findOne: 'posts.read',
      create: 'posts.create',
      update: 'posts.update',
      remove: 'posts.delete',
      findAuditLogs: 'posts.audit.read',
    },
  }
) {
  constructor(public readonly service: PostService) {
    super(service);
  }
}
```

`CreateNestedCrudController` writes the same metadata key used by `@Permissions(...)`, so `PermissionsGuard` works on generated CRUD handlers automatically.

This gives you standard endpoints:

- `POST /posts`
- `GET /posts`
- `GET /posts/:id`
- `PATCH /posts/:id`
- `DELETE /posts/:id`

---

## Query features

### Pagination

```http
GET /posts?page=1&limit=20
```

### Filters

```http
GET /posts?filter[published_eq]=true
GET /posts?filter[title_cont]=nestjs
GET /posts?filter[views_gte]=100
```

### Compound filtering

```http
GET /posts?filter[published_eq]=true&filter[views_gte]=100
```

### Recommended operators

- `_eq` equals
- `_cont` contains (string search)
- `_gte` greater than or equal
- `_lte` less than or equal

---

## Global app setup required

```ts
app.useGlobalPipes(
  new ValidationPipe({ transform: true, enableImplicitConversion: true })
);
app.useGlobalFilters(new TypeOrmExceptionFilter());
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

Without `query parser = extended`, nested query keys like `filter[name_cont]` may fail parsing.

---

## Extension patterns

### Override create/update for business rules

```ts
async create(dto: CreatePostDto) {
  if (dto.title.length < 5) {
    throw new BadRequestException('Title too short');
  }

  return super.create(dto);
}
```

### Add query guards by role

Inject request user context and apply additional where constraints before delegating.

### Keep base consistency

Prefer extending methods rather than replacing all CRUD behavior so pagination/filtering remains consistent across teams.

---

## Best practices

- Keep DTOs strict and explicit
- Add DB indexes to frequently filtered columns
- Use relation loading intentionally to avoid N+1 behavior
- Document custom filters in each module README
- Pair CRUD endpoints with auth guards where needed
