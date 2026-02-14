# Getting Started

This guide gets you from zero to a working Nest-Util-powered resource quickly.

## Prerequisites

- Node.js 20+
- pnpm 10+
- NestJS project using TypeORM

## 1) Install libraries

```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-auth-0.0.1.tgz
```

Install CLI globally:

```bash
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

## 2) Generate a feature

```bash
ncnu --gen Project --path apps/demo-api/src/app name:string description:string isActive:boolean
```

Generated output includes:

- `project.entity.ts`
- `create-project.dto.ts`
- `update-project.dto.ts`
- `project.service.ts`
- `project.controller.ts`

## 3) Register module

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
```

## 4) Configure app defaults

```ts
app.useGlobalPipes(
  new ValidationPipe({ transform: true, enableImplicitConversion: true })
);
app.useGlobalFilters(new TypeOrmExceptionFilter());
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

## 5) Verify endpoints

```bash
GET /project?page=1&limit=10
GET /project?filter[name_cont]=core
POST /project
PATCH /project/1
DELETE /project/1
```

Proceed to [nest-crud](nest-crud.md) and [nest-auth](nest-auth.md) for deeper customization.
