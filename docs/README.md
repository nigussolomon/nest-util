# Nest-Util

Nest-Util is a collection of powerful utilities designed to streamline building robust and scalable NestJS applications. 

## Features

- **@nest-util/nest-crud**: A generic, highly flexible CRUD system for TypeORM entities.
- **ncnu**: A command-line tool to generate boilerplate code for entities, services, and controllers with full CRUD support.
- **@nest-util/nest-auth**: Authentication utilities and patterns.

## Getting Started

To explore the utilities, check out the specific documentation for each component:

- [CRUD System](nest-crud)
- [NCNU Generator](ncnu)
- [Auth Utilities](nest-auth)

## Repository

Find our source code on [GitHub](https://github.com/nigussolomon/nest-util).

---

## Global Configuration

To ensure consistent behavior across your application, the following configurations are highly recommended (as seen in our demo-api):

### 1. ValidationPipe
Configure the global `ValidationPipe` to enable automatic transformation of request payloads:
```typescript
app.useGlobalPipes(new ValidationPipe({ 
  transform: true, 
  enableImplicitConversion: true 
}));
```

### 2. TypeOrmExceptionFilter
Use the global filter from `@nest-util/nest-crud` to gracefully handle database-specific errors:
```typescript
app.useGlobalFilters(new TypeOrmExceptionFilter());
```

### 3. Query Parser
Configure your HTTP adapter to use the `extended` query parser for handling complex nested query strings used by the CRUD system.

### 4. Swagger Documentation
API documentation is automatically compatible with Swagger. Ensure you have `@nestjs/swagger` installed and configured to serve docs at `/api/docs`.
