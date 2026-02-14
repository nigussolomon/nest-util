# Getting Started

This guide takes you from installation to a production-shaped feature using Nest-Util.

## Prerequisites

- Node.js 20+
- pnpm 10+
- NestJS app with TypeORM configured
- A running database (PostgreSQL recommended)

## What you will build

In this guide, you will:

1. Install `@nest-util/nest-crud`, `@nest-util/nest-auth`, and `ncnu`
2. Generate a resource module using `ncnu`
3. Register the generated resource in your app
4. Add core global runtime configuration
5. Protect selected routes with auth
6. Verify pagination/filter behavior

---

## 1) Install libraries

```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-auth-0.0.1.tgz
```

Install CLI globally:

```bash
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

Validate install:

```bash
ncnu --help
```

---

## 2) Generate a feature

Generate a `Project` module:

```bash
ncnu --gen Project --path apps/demo-api/src/app name:string description:string isActive:boolean
```

Generated output:

- `project.entity.ts`
- `create-project.dto.ts`
- `update-project.dto.ts`
- `project.service.ts`
- `project.controller.ts`

### Recommended post-generation edits

- Add database indexes to high-cardinality search fields
- Add relation columns (`ManyToOne`, `OneToMany`) as needed
- Add domain-specific validation decorators in DTOs

---

## 3) Register module

Create and register a module to wire entity + service + controller:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
```

Then import into `AppModule`:

```ts
@Module({
  imports: [ProjectModule],
})
export class AppModule {}
```

---

## 4) Configure app defaults

Set these in `main.ts` to unlock full query/filter support and stable error handling:

```ts
app.useGlobalPipes(
  new ValidationPipe({ transform: true, enableImplicitConversion: true })
);

app.useGlobalFilters(new TypeOrmExceptionFilter());

app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

Why these matter:

- `transform + implicit conversion`: keeps query/body types aligned with DTOs
- `TypeOrmExceptionFilter`: prevents leaking raw database errors
- `query parser=extended`: supports nested query syntax like `filter[field_op]`

---

## 5) Add authentication module

Minimal auth setup:

```ts
NestAuthModule.forRoot({
  entity: User,
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  fieldMap: {
    username: 'email',
    password: 'password',
    refreshToken: 'refreshToken',
  },
});
```

Then use route decorators:

- `@Public()` for anonymous endpoints
- default JWT guard for protected endpoints
- `@CurrentUser()` to access auth context

---

## 6) Verify endpoints

```bash
GET /project?page=1&limit=10
GET /project?filter[name_cont]=core
POST /project
PATCH /project/1
DELETE /project/1
```

### Filter examples

```bash
GET /project?filter[isActive_eq]=true
GET /project?filter[id_gte]=10
GET /project?filter[name_cont]=infra&filter[isActive_eq]=true
```

---

## 7) Production checklist

- Enable rate limiting and CORS policy
- Store JWT secrets in CI-managed environment variables
- Add unit + e2e tests for generated modules
- Add DB migration for each schema change
- Add branch protection requiring CI + Security workflows

Proceed to:

- [Architecture](architecture.md)
- [nest-crud](nest-crud.md)
- [nest-auth](nest-auth.md)
- [CI/CD & GitHub Pages](cicd.md)
