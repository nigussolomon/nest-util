# nest-crud

This library was generated with [Nx](https://nx.dev).

## Installation

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^1.0.7 @nest-util/nest-auth@^1.1.0 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
```

## Features

- Generic CRUD service with filtering, pagination, and sorting
- Controller factory that generates 7 REST endpoints
- Built-in audit logging with `@Audit()` decorator
- Lifecycle hooks (before/after) with transaction support
- Cursor-based pagination for efficient large-dataset traversal
- User-scoped record retrieval via `GET /resource/mine`
- Automatic Swagger documentation
- TypeORM exception filter for duplicate key errors

## Filtering and Sorting

### Filtering

Query format: `?filter[field_operator]=value` (requires Express `query parser` set to `extended`).

```typescript
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

Supported operators: `eq`, `ne`, `cont`, `notcont`, `starts`, `ends`, `gte`, `lte`, `gt`, `lt`, `in`, `nin`, `isnull`. Groups via `filter[and][0][field_eq]=...` and `filter[or][0][field_eq]=...`.

Filterable fields must be whitelisted with `allowedFilters` in the service options.

### Filtering by nested (related) fields

Nested relation fields use dot notation. The relation must be listed in `include` (so the join exists) and the full path must be whitelisted in `allowedFilters`:

```typescript
super({
  repository,
  include: ['author', 'author.profile'],
  allowedFilters: ['title', 'author.name', 'author.profile.bio'],
});
```

```http
GET /post?filter[author.name_cont]=John
GET /post?filter[author.profile.bio_starts]=Software
```

Nested filter keys with dots resolve against the joined alias (`author.name` → `author.name`, `author.profile.bio` → `author_profile.bio`). A nested filter whose join prefix is missing from `include` is silently skipped.

### Sorting

```http
GET /post?orderBy=title&orderDirection=ASC
```

Sort fields are whitelisted with `allowedSortFields`. Nested sorting works the same way:

```typescript
super({
  repository,
  include: ['author'],
  allowedSortFields: ['id', 'title', 'author.name'],
});
```

```http
GET /post?orderBy=author.name&orderDirection=DESC
```

Nested sort paths also require their join prefix to be in `include`. Cursor pagination keeps its fixed `id` ordering.

## Building

Run `nx build nest-crud` to build the library.

## Running unit tests

Run `nx test nest-crud` to execute the unit tests via [Jest](https://jestjs.io).
