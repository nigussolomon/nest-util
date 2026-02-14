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


---

## `@nest-util/nest-file`

### `NestFileModule.forRoot(options)`

Essential options:

- `minio` connection options (`endPoint`, credentials, TLS/port)
- `bucket` options (`bucket`, optional region, auto-create behavior)
- `encryption.key` (base64-encoded 32-byte key)

### `StoredFileService`

Core methods:

- `store(input)`
- `getById(fileId)`
- `listByOwner(ownerType, ownerId)`
- `remove(fileId)`

### `StoredFileEntity`

Metadata persisted in Postgres:

- object key + original file metadata
- owner mapping (`ownerType`, `ownerId`)
- encryption metadata (`iv`, `authTag`, `digest`, algorithm, key id)
