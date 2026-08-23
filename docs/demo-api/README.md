# demo-api Configuration Guide

`apps/demo-api` is a run-ready example that wires together every package in the
repository. Use it as a reference for your own `AppModule` and `main.ts`.

## 1) Bootstrap (`src/main.ts`)

The app does the following on startup:

1. Creates the app with `NestFactory.create(AppModule)`.
2. Sets a global `api` prefix, so routes live under `/api`.
3. Enables global validation with:
   - `transform: true`
   - `whitelist: true`
   - `transformOptions.enableImplicitConversion: true`
4. Enables CORS.
5. Registers Swagger (title `Demo API`, bearer auth enabled) at `/api/docs`.
6. Sets the Express query parser to `extended` — required for
   `filter[field_operator]=value` deep-object queries.
7. Listens on `process.env.PORT || 3008`.

Error handling is **not** done with a manual `TypeOrmExceptionFilter` here. The
global `LocalizedExceptionFilter` is registered by `LocalizationModule` (see
below), so every error renders as the standardized localized body.

## 2) Module wiring (`src/app/app.module.ts`)

`AppModule` composes all packages:

1. Configures a Postgres `TypeOrmModule.forRoot` with `autoLoadEntities: true`
   and `synchronize: true`.
2. Registers the demo entities (`Post`, `Comment`) and modules.
3. Imports `NestCrudModule` (provides `AuditService` and registers
   `AuditLogEntity`).
4. Imports `AuditEventModule.forRoot(...)` with a `ConsoleHandler`.
5. Imports `AuthModule.forRoot(...)` with DTOs, user entity, RBAC, API keys,
   rate limiting, lockout, OTP, password reset, user management, onboarding, and
   a permission registry.
6. Imports `PaymentModule`, `NotifyModule`, and `NestFileModule.forRoot(...)`.
7. Registers `LocalizationModule.forRoot(...)` — this is what wires the global
   error filter.
8. Applies `ResponseInterceptor` and `AuditInterceptor` globally via
   `APP_INTERCEPTOR`.

## 3) Auth configuration in the demo app

Key `AuthModule.forRoot` values:

- `userEntity: User`
- `identifierField: 'email'`
- `passkeyField: 'password'`
- `jwtSecret: 'super-secret-key'`
- `refreshTokenSecret: 'super-secret-key'`
- `refreshTokenExpiresIn: '7d'`
- `accessTokenField: 'accessToken'`, `refreshTokenField: 'refreshToken'`
- `apiKey: { enabled: true }`
- `rateLimit` and `loginAttempts` configured
- `otp`, `passwordReset`, and `onboarding` all enabled with demo delivery hooks
  that log the code/token instead of actually sending it
- `relations: ['userRoles', 'userRoles.role']`
- RBAC keys: `userRolesRelation: 'userRoles'`, `rolesKey: 'userRoles'`,
  `nestedRoleKey: 'role'`
- `userManagement` with whitelisted create/update/profile fields
- `permissionRegistry` loaded from `src/app/auth/permission-registry.ts`

## 4) CRUD resource pattern

Each resource (for example `Post`, `Comment`) follows the same shape:

1. The service extends `NestCrudService<Entity, CreateDto, UpdateDto>`.
2. The service injects the TypeORM repository and passes options to `super(...)`.
3. The controller extends the class returned by `CreateNestedCrudController(...)`.
4. Auth and permissions are attached with `@UseGuards(JwtAuthGuard, PermissionsGuard)`.

### Post service

`PostService` demonstrates ownership and two pipelines at once:

```ts
super({
  repository,
  allowedFilters: [],
  userOwnershipField: 'authorId',
  enforceOwnership: true,
  ownershipBypassPermissions: ['admin.access'],
  superAdminPermission: 'admin.access',
  statusPipeline: {
    field: 'status',
    initial: 'draft',
    transitions: [
      { from: 'draft', to: ['pending'] },
      { from: 'pending', to: ['approved', 'rejected'] },
      {
        from: 'approved',
        to: ['published'],
        action: async ({ id, entity }) => {
          console.log(`Post ${id} published at ${entity.status}`);
        },
      },
      { from: 'rejected', to: ['pending'] },
    ],
    onTransition: async ({ id, from, to, user }) => {
      console.log(
        `Post ${id} transitioned ${from} -> ${to} by ${user?.id ?? 'anonymous'}`
      );
    },
  },
  approvalPipeline: {
    permissions: {
      approve: 'posts.approve',
      reject: 'posts.reject',
      requestModification: 'posts.update',
      resubmit: 'posts.update',
    },
  },
});
```

### Post controller

`PostController` maps approval endpoints to permission actions, enables
`findMine`, and names the resource for audit logging:

```ts
const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
  {
    permissions: {
      ...buildCrudPermissionsFromRegistry(permissionRegistry, {
        resource: 'posts',
        endpointActions: {
          getApproval: 'read',
          approveApproval: 'approve',
          rejectApproval: 'reject',
          requestModification: 'update',
          resubmitApproval: 'update',
        },
      }),
      changeStatus: 'posts.changeStatus',
    },
    enableFindMine: true,
  }
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

@ApiTags('post')
@Controller('post')
@EntityName({ singular: 'post', plural: 'posts' })
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

## 5) Post entity with findMine

`Post` includes an indexed `authorId` column so user-scoped queries stay fast:

```ts
@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  content!: string;

  @Index()
  @Column({ nullable: true })
  authorId?: number;
}
```

`PostService` sets `userOwnershipField: 'authorId'`, and `PostController` passes
`enableFindMine: true`.

## 6) Running the demo

```bash
./db.sh                     # start PostgreSQL (and MinIO)
npx nx serve demo-api       # start the API
```

- API: `http://localhost:3008/api`
- Swagger: `http://localhost:3008/api/docs`

## 7) Help notes

- Keep `query parser` set to `extended` for nested filter objects.
- Keep `autoLoadEntities: true` — the libraries register their entities through it.
- `AuditInterceptor` only records handlers decorated with `@Audit(...)` (the CRUD
  controller factory already decorates its endpoints).
- `ResponseInterceptor` wraps output in a standard `{ message, data, meta, status }`
  shape.
- Error responses come from `LocalizationModule`; there is no manual global
  `TypeOrmExceptionFilter` in this app.
