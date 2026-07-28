# Nest Util Documentation

This documentation is regenerated from the current source code and demo app setup.

## Docs Structure

- [demo-api setup](./demo-api/README.md)
- [nest-auth setup guide](./nest-auth/README.md)
- [nest-crud setup guide](./nest-crud/README.md)
- [nest-file setup guide](./nest-file/README.md)
- [nest-payment setup guide](./nest-payment/README.md)
- **nest-notify** (Coming Soon) — Multi-channel notifications

## Quick Start Order

If you are integrating all modules in one NestJS app, use this order:

1. Configure TypeORM and entities.
2. Add `AuthModule.forRoot(...)`.
3. Build resource services using `NestCrudService`.
4. Build resource controllers using `CreateNestedCrudController(...)`.
5. Add `NestFileModule.forRoot(...)` for file uploads.
6. Add `NestPaymentModule.forRoot(...)` with your payment provider implementation.
7. Apply global interceptors and filters as shown in [demo-api setup](./demo-api/README.md).
