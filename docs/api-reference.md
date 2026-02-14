# API Reference

## `@nest-util/nest-crud`

### `NestCrudService<T>`

Common methods available in derived services:

- `create(dto)`
- `findAll(query)`
- `findOne(id)`
- `update(id, dto)`
- `remove(id)`

### `CreateNestedCrudController()`

Factory that produces REST handlers bound to provided entity and DTO types.

### `TypeOrmExceptionFilter`

Global filter that transforms TypeORM errors into predictable API errors.

---

## `@nest-util/nest-auth`

### `NestAuthModule.forRoot(options)`

Essential options:

- `entity`
- `jwtSecret`
- `refreshSecret`
- `fieldMap`
- optional route toggles and custom DTO types

### Decorators/guards

- `@Public()`
- `@CurrentUser()`
- JWT auth guard and strategy exports

---

## `ncnu`

### CLI flags

- `--gen`: model/resource name
- `--path`: output folder path

### Positional field definitions

- `<field>:<type>` pairs for entity and DTO generation

For implementation details, inspect source in `libs/ncnu/src/lib/generate.ts`.
