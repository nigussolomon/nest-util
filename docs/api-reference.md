# API Reference

This section provides detailed API documentation for the core packages of `nest-util`.

## Packages

### 1. [@nest-util/nest-crud](nest-crud?id=api-reference)

- **[NestCrudService](nest-crud?id=nestcrudservice-methods)**: Base service for CRUD operations.
- **[CreateNestedCrudController](nest-crud?id=createnestedcrudcontroller)**: Factory for generating controllers.
- **IBaseController**: Interface for controller type safety.
- **TypeOrmExceptionFilter**: Global filter for handling DB errors.

### 2. [@nest-util/nest-auth](nest-auth?id=api-reference)

- **[AuthService](nest-auth?id=authservice)**: Service for login, register, and token management.
- **[AuthModule](nest-auth?id=authmoduleoptions)**: Dynamic module for configuring authentication.
- **[Guards](nest-auth?id=jwtauthguard)**: `JwtAuthGuard` for protecting routes.
- **[Decorators](nest-auth?id=decorators)**: `@CurrentUser()`, `@Public()`, etc.

### 3. [ncnu (CLI)](ncnu?id=cli-reference)

- **[Command Syntax](ncnu?id=command-syntax)**: Usage of the generator tool.
- **[Field Types](ncnu?id=field-types-reference)**: Supported data types for generation.
