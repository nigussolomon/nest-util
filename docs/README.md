# Nest-Util Documentation

Nest-Util is a toolkit for building production-ready NestJS backends quickly and consistently.

## Packages

- **`@nest-util/nest-crud`**: Generic CRUD base classes with filtering, pagination, and response helpers.
- **`@nest-util/nest-auth`**: Dynamic JWT authentication module with refresh token rotation.
- **`ncnu`**: CLI generator that scaffolds entities, DTOs, services, and controllers.

## Why teams use Nest-Util

- Reduce repeated CRUD/service/controller boilerplate.
- Keep API responses and query capabilities consistent across modules.
- Onboard engineers faster with predictable generated structure.
- Ship faster with ready-to-use auth and resource generation patterns.

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

Then register your generated module and run your Nest application.
