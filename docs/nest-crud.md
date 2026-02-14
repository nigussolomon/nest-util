# `@nest-util/nest-crud`

`nest-crud` gives you reusable CRUD building blocks for TypeORM-based modules.

## Core exports

- `NestCrudService<T>`
- `CreateNestedCrudController<T, CreateDto, UpdateDto>()`
- `TypeOrmExceptionFilter`
- Filtering and pagination helper DTOs

## Service pattern

Extend the base service with your entity:

```ts
@Injectable()
export class PostService extends NestCrudService<Post> {
  constructor(@InjectRepository(Post) repo: Repository<Post>) {
    super(repo, Post);
  }
}
```

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

### Multiple filters

```http
GET /posts?filter[published_eq]=true&filter[views_gte]=100
```

## Recommended global setup

```ts
app.useGlobalPipes(
  new ValidationPipe({ transform: true, enableImplicitConversion: true })
);
app.useGlobalFilters(new TypeOrmExceptionFilter());
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

## Extension tips

- Override generated methods for business rules and permission checks.
- Add domain-specific query helpers in your derived service.
- Keep base behavior for pagination/filtering to preserve consistency.
