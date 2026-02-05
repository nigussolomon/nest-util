# Nest Util

A collection of high-quality NestJS utilities and libraries designed to accelerate development by providing reusable patterns for common tasks like CRUD operations and authentication.

## 🚀 Libraries

### @nest-util/nest-crud
A powerful and flexible CRUD library that provides:
- **`NestCrudService`**: A base service that handles common TypeORM operations with built-in support for filtering and pagination.
- **`CreateNestedCrudController`**: A controller factory that generates fully-functional REST controllers for your entities.
- **Filtering & Pagination**: Out-of-the-box support for complex query parameters.
- **Response Normalization**: Interceptors and decorators to ensure consistent API responses.

### @nest-util/nest-auth
*(Work in Progress)* - A planned library for streamlined authentication and authorization patterns.

## 📱 Demo Application

### demo-api
A reference implementation showing how to use `nest-crud`. Check out the **Users module** in the demo application to see it in action.

---

## 🛠️ Getting Started

### Installation
Ensure you have `pnpm` installed, then run:
```sh
pnpm install
```

### Database Setup
1. Start the database (requires Docker):
   ```sh
   ./db.sh
   ```
2. Run migrations:
   ```sh
   cd apps/demo-api && pnpm migration:run
   ```

### Running the Demo
Run the API:
```sh
npx nx serve demo-api
```
Explore the API documentation at `http://localhost:3000/api` (Swagger).

## 🧑‍💻 Development

This workspace uses [Nx](https://nx.dev).

### Useful Commands
- **Run graph**: `npx nx graph` - Visually explore dependencies.
- **Generate library**: `npx nx g @nx/js:lib packages/pkg-name`
- **Lint**: `npx nx lint`

### Testing
To run tests for the demo API or libraries:
```sh
# Run tests for demo-api
npx nx test demo-api

# Run tests for a library
npx nx test nest-crud
```

> [!NOTE]
> **Global Configuration (demo-api)**
> The demo application includes several global configurations in its bootstrap process to ensure consistent behavior:
> - **ValidationPipe**: Configured with `transform: true` and `enableImplicitConversion: true` to automatically convert request payloads to DTO instances.
> - **TypeOrmExceptionFilter**: A global filter from `@nest-util/nest-crud` that gracefully handles database-specific errors.
> - **Query Parser**: The HTTP adapter is configured to use the `extended` query parser for handling complex nested query strings.
> - **Swagger**: API documentation is automatically generated and available at `/api/docs`.

---
