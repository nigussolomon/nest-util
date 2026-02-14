# Nest-Util Documentation

Nest-Util is a toolkit for building production-ready NestJS backends quickly and consistently.

## Package overview

- **`@nest-util/nest-crud`**: Generic CRUD base classes with filtering, pagination, and response helpers.
- **`@nest-util/nest-auth`**: Dynamic JWT authentication module with refresh token rotation.
- **`ncnu`**: CLI generator that scaffolds entities, DTOs, services, and controllers.

## Why teams adopt Nest-Util

- Reduce repeated CRUD and controller boilerplate
- Keep API response/query behavior consistent across modules
- Standardize auth patterns without locking into one schema shape
- Shorten onboarding for new contributors

## Documentation map

1. [Getting Started](getting-started.md)
2. [Architecture](architecture.md)
3. [nest-crud guide](nest-crud.md)
4. [nest-auth guide](nest-auth.md)
5. [ncnu guide](ncnu.md)
6. [Examples](examples.md)
7. [API Reference](api-reference.md)
8. [CI/CD & GitHub Pages](cicd.md)
9. [Troubleshooting](troubleshooting.md)

---

## Quick install

```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-crud-0.0.1.tgz
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-auth-0.0.1.tgz
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

## Quick generation

```bash
ncnu --gen Post --path apps/demo-api/src/app title:string content:string published:boolean
```

## First-run recommendations

- Add global validation + TypeORM exception filter
- Configure query parser as `extended`
- Add auth module and protect non-public routes
- Add tests for generated resources before production release
