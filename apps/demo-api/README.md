# Demo API

This app demonstrates all published Nest Util libraries in one runnable API:

- `@nest-util/nest-crud` for generated CRUD controllers/services (`users`, `posts`, `comments`)
- `@nest-util/nest-auth` for login + JWT guard on protected endpoints
- `@nest-util/nest-audit` for action audit logging via `@Audit(...)` decorator
- `@nest-util/nest-file` for encrypted file storage with MinIO + Postgres metadata

## Quick start with Docker Compose

```bash
cd apps/demo-api
cp .env.example .env
docker compose up --build
```

Once started:

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Library usage map

### 1) `@nest-util/nest-crud`

- CRUD base service: `UsersService`, `PostService`, `CommentService`
- CRUD controller factory: `CreateNestedCrudController(...)` in each controller
- Response formatting: global `ResponseInterceptor`
- TypeORM exception handling: global `TypeOrmExceptionFilter`

### 2) `@nest-util/nest-auth`

- Dynamic auth setup in `AppModule` via `AuthModule.forRoot(...)`
- JWT route protection with `JwtAuthGuard`
- Auth endpoints exposed under `/api/auth` (`login`, `refresh`, etc.)

### 3) `@nest-util/nest-audit`

- `NestUtilNestAuditModule` imported in `AppModule`
- `AuditInterceptor` enabled globally
- `@Audit(...)` used in file endpoints to create audit records in `audit_logs`

### 4) `@nest-util/nest-file`

- `NestFileModule.forRoot(...)` configured with MinIO + encryption
- `StoredFileService` used by `/api/files` endpoints
- `UploadFileDto` + `FileOwnerEntity(...)` demonstrated in the file controller

## End-to-end example

### 1) Log in

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}'
```

Save `accessToken` and use it below:

```bash
export TOKEN='<accessToken>'
```

### 2) Create a post (CRUD)

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","content":"Demo post","authorId":1}'
```

### 3) Upload a file (encrypted storage)

```bash
curl -X POST http://localhost:3000/api/files \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName":"hello.txt",
    "contentType":"text/plain",
    "ownerType":"user",
    "ownerId":"1",
    "contentBase64":"SGVsbG8gZnJvbSBuZXN0LXV0aWw="
  }'
```

This also produces audit entries in `audit_logs` because the route is decorated with `@Audit(...)`.
