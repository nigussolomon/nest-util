# Architecture

Nest-Util is designed around three focused layers.

## Layer 1: Generation

`ncnu` produces structured resource modules:

- Entity with TypeORM decorators
- Create/Update DTOs with class-validator decorators
- Service extending `NestCrudService`
- Controller extending `CreateNestedCrudController`

## Layer 2: Runtime CRUD

`@nest-util/nest-crud` provides:

- Generic repository-backed service methods
- Query filter parsing and pagination
- Standardized response interceptors
- TypeORM exception filtering helper

## Layer 3: Authentication

`@nest-util/nest-auth` provides:

- Dynamic auth options (entity + field mappings)
- Registration/login endpoints
- Access and refresh token issuance
- Refresh token rotation with nonce strategy

## Typical request lifecycle

1. Controller receives request with filter/pagination params.
2. DTO/pipe validation normalizes input.
3. `NestCrudService` composes query and repository operations.
4. Interceptor shapes response metadata.
5. Optional auth guards validate JWT and attach user context.

## Design goals

- **Consistency:** every resource follows predictable endpoint behavior.
- **Extensibility:** teams can override generated methods for custom logic.
- **Security:** auth defaults encourage strong password + token practices.
- **Maintainability:** small reusable primitives instead of hand-written repetition.
