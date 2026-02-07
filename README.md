# Nest Util

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=for-the-badge&logo=typeorm&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)

A collection of high-quality NestJS utilities designed to accelerate development by providing reusable patterns for CRUD operations, authentication, and rapid code generation.

📖 **[View Full Documentation](https://nigussolomon.github.io/nest-util/)**

---

## 🚀 Key Features

### 1. @nest-util/nest-crud
A powerful and flexible CRUD library featuring:
- **`NestCrudService`**: Generic base service for common TypeORM operations with built-in filtering and pagination.
- **`CreateNestedCrudController`**: Controller factory that generates fully-functional REST endpoints for your entities.
- **Auto-Documentation**: Seamless integration with Swagger/OpenAPI.

### 2. ncnu (CLI Generator)
A professional code generation tool to scaffold your NestJS resources:
- **Rapid Prototyping**: Generate Entity, Service, Controller, and DTOs in seconds.
- **Smart Mapping**: Automatically handles TypeORM column types and Swagger decorators.
- **Definite Assignment**: Generates code compatible with strict TypeScript property initialization.

### 3. @nest-util/nest-auth
A dynamic and flexible authentication library:
- **`AuthModule`**: Dynamic configuration for entities, fields, and JWT.
- **`AuthService`**: Built-in registration and login with bcrypt hashing.
- **Custom Decorators**: `@Public()`, `@CurrentUser()`, and `@AuthOptions()`.
- **Route Disabling**: Easily disable auth endpoints via configuration.

---

## 🛠️ Installation

### Using the Generator (ncnu)
Install the generator globally from the latest GitHub Release:
```sh
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

Usage:
```sh
ncnu --gen ModuleName --path apps/demo-api/src/app title:string userId:number
```

### Development Setup
Ensure you have `pnpm` installed:
1. Clone the repo and run `pnpm install`.
2. Start the database: `./db.sh`.
3. Run the demo API: `npx nx serve demo-api`.

Explore the API documentation at `http://localhost:3000/api/docs`.

---

## 🧑‍💻 Development

This workspace uses [Nx](https://nx.dev).

### Useful Commands
- **Run graph**: `npx nx graph` - Visually explore dependencies.
- **Lint**: `npx nx lint`
- **Build All**: `npx nx run-many -t build`

### Testing
```sh
# Run tests for a library
npx nx test nest-crud
```

---

> [!IMPORTANT]
> **Global Configuration (demo-api)**
> The demo application includes several global configurations in its bootstrap process to ensure consistent behavior:
> - **ValidationPipe**: Configured with `transform: true` and `enableImplicitConversion: true` to automatically convert request payloads to DTO instances.
> - **TypeOrmExceptionFilter**: A global filter from `@nest-util/nest-crud` that gracefully handles database-specific errors.
> - **Query Parser**: The HTTP adapter is configured to use the `extended` query parser for handling complex nested query strings.
> - **Swagger**: API documentation is automatically generated and available at `/api/docs`.

---

> [!TIP]
> **GitHub Pages**: Detailed documentation is automatically deployed to GitHub Pages on every push to the `main` branch. Check it out at [nigussolomon.github.io/nest-util](https://nigussolomon.github.io/nest-util/).
