# Nest Util Documentation

This documentation is regenerated from the current source code and demo app setup.

## Docs Structure

- [demo-api setup](./demo-api/README.md)
- [nest-auth setup guide](./nest-auth/README.md)
- [nest-crud setup guide](./nest-crud/README.md)
- [nest-audit setup guide](./nest-audit/README.md)

## Quick Start Order

If you are integrating all modules in one NestJS app, use this order:

1. Configure TypeORM and entities.
2. Add `NestUtilNestAuditModule`.
3. Add `AuthModule.forRoot(...)`.
4. Build resource services using `NestCrudService`.
5. Build resource controllers using `CreateNestedCrudController(...)`.
6. Apply global interceptors and filters as shown in [demo-api setup](./demo-api/README.md).
