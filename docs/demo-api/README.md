# demo-api Configuration Guide

This guide documents how the `apps/demo-api` app is currently wired.

## 1) Bootstrap Configuration (`src/main.ts`)

The app bootstraps with the following runtime behavior:

1. Creates the Nest app with `NestFactory.create(AppModule)`.
2. Sets a global API prefix to `api`.
3. Enables global validation with:
   - `transform: true`
   - `whitelist: true`
   - `transformOptions.enableImplicitConversion: true`
4. Registers Swagger with:
   - title: `Demo API`
   - description: `CRUD API with NestUtil`
   - version: `1.0`
   - bearer auth enabled
5. Exposes Swagger UI at `/api/docs`.
6. Sets Express query parser to `extended`.
7. Applies global `TypeOrmExceptionFilter` (from `@nest-util/nest-crud`).
8. Listens on `process.env.PORT || 3000`.

## 2) Module Wiring (`src/app/app.module.ts`)

`AppModule` composes all three util modules together:

1. Configures TypeORM Postgres connection from env vars:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `autoLoadEntities: true`
   - `synchronize: true`
2. Registers feature entities for demo resources (`Post`, `Comment`).
3. Imports `NestUtilNestAuditModule`.
4. Imports `AuthModule.forRoot(...)` with DTOs, user entity, RBAC settings, and permission registry.
5. Applies global interceptors:
   - `ResponseInterceptor` (from `@nest-util/nest-crud`)
   - `AuditInterceptor` (from `@nest-util/nest-audit`)

## 3) Auth Configuration in Demo API

The demo app uses:

- `userEntity: User`
- `identifierField: 'email'`
- `passkeyField: 'password'`
- `jwtSecret: 'super-secret-key'`
- `refreshTokenSecret: 'super-secret-key'`
- `refreshTokenExpiresIn: '7d'`
- `refreshTokenField: 'refreshToken'`
- `accessTokenField: 'accessToken'`
- `loginDto`, `registerDto`, `refreshDto`
- `relations: ['userRoles', 'userRoles.role']`
- RBAC mapping:
  - `userRolesRelation: 'userRoles'`
  - `rolesKey: 'userRoles'`
  - `nestedRoleKey: 'role'`
- `permissionRegistry` loaded from `src/app/auth/permission-registry.ts`

## 4) CRUD Resource Pattern in Demo API

For each resource (example: `Post`, `Comment`):

1. Service extends `NestCrudService<Entity, CreateDto, UpdateDto>`.
2. Service injects TypeORM repository and passes `repository` to `super(...)`.
3. Controller extends `CreateNestedCrudController(...)` output class.
4. Optional auth/permissions are attached using `JwtAuthGuard` + `PermissionsGuard`.

## 5) Help Notes

- If query-based filtering does not parse correctly, keep `query parser` set to `extended`.
- Keep `TypeOrmExceptionFilter` global to normalize duplicate key errors.
- `AuditInterceptor` only writes logs for handlers decorated with `@Audit(...)`.
- `ResponseInterceptor` wraps output in a standard `{ message, data, meta, status }` shape.
