# nest-crud

This library was generated with [Nx](https://nx.dev).

## Installation

To install this library in your project, use the permanent URL from the latest GitHub Release:

```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.1.1.tgz
```

> **Tip:** This tarball contains only the compiled code and its specific dependencies, making it as clean as a standard npm package.

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
