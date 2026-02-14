# Examples

## Blog API resource

```bash
ncnu --gen Post --path apps/demo-api/src/app \
  title:string content:string published:boolean authorId:number
```

Common queries:

- `GET /post?page=1&limit=10`
- `GET /post?filter[published_eq]=true`
- `GET /post?filter[title_cont]=nestjs`

## Admin + public route split

- Mark read endpoints public with `@Public()`.
- Keep create/update/delete protected with JWT guard.

## Adding custom business logic

Override generated service methods:

```ts
async create(dto: CreatePostDto) {
  if (dto.title.length < 5) throw new BadRequestException('Title too short');
  return super.create(dto);
}
```

## API response standardization

Use built-in response interceptor from `nest-crud` globally to keep success shape consistent across all resources.
