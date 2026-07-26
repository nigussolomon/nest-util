# nest-crud

This library was generated with [Nx](https://nx.dev).

## Installation

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^1.0.2 @nest-util/nest-auth@^1.0.2 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
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

## Building

Run `nx build nest-crud` to build the library.

## Running unit tests

Run `nx test nest-crud` to execute the unit tests via [Jest](https://jestjs.io).
