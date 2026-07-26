# Nest Util Documentation

This documentation is regenerated from the current source code and demo app setup.

## Docs Structure

- [demo-api setup](./demo-api/README.md)
- [nest-auth setup guide](./nest-auth/README.md)
- [nest-crud setup guide](./nest-crud/README.md)

## Quick Start Order

If you are integrating all modules in one NestJS app, use this order:

1. Configure TypeORM and entities.
2. Add `AuthModule.forRoot(...)`.
3. Build resource services using `NestCrudService`.
4. Build resource controllers using `CreateNestedCrudController(...)`.
5. Apply global interceptors and filters as shown in [demo-api setup](./demo-api/README.md).
