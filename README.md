# Nest Util

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=for-the-badge&logo=typeorm&logoColor=white)

A collection of reusable, production-ready **NestJS** utilities that remove the
boilerplate you usually write for every app: CRUD, authentication, error handling,
file uploads, payments, and notifications.

- **Start here:** [Documentation index](./docs/README.md)
- **Run the example:** [demo-api setup](./docs/demo-api/README.md)
- **Upgrading an existing app:** [Migration Guide](./MIGRATION-GUIDE.md)

---

## The packages

| Package | What it does | Guide |
|---|---|---|
| `@nest-util/nest-crud` | Generic CRUD service + controller factory, filtering, pagination, hooks, ownership, status/approval pipelines, audit logging | [nest-crud](./docs/nest-crud/README.md) |
| `@nest-util/nest-auth` | Registration/login, JWT + refresh tokens, permissions/RBAC, API keys, OTP, password reset, onboarding | [nest-auth](./docs/nest-auth/README.md) |
| `@nest-util/nest-error` | Standardized, localized error responses for every package (required peer) | [nest-error](./libs/nest-error/README.md) |
| `@nest-util/nest-file` | S3/MinIO-compatible file uploads with presigned URLs and metadata tracking | [nest-file](./docs/nest-file/README.md) |
| `@nest-util/nest-notify` | FCM push + SMTP email notifications with history and optional WebSocket streaming | [nest-notify](./docs/nest-notify/README.md) |
| `@nest-util/nest-payment` | Provider-agnostic checkout, subscriptions, refunds, webhooks, and reconciliation | [nest-payment](./docs/nest-payment/README.md) |

The packages are designed to be used together in one NestJS app, but each is
independently installable. Only `@nest-util/nest-error` is a required peer
dependency of the others.

---

## Prerequisites

- **Node.js** 18 or newer
- **NestJS** 11
- **TypeORM** 1.1
- **Express** 5 (already the default with NestJS 11)
- **pnpm** (recommended) or npm
- A database (PostgreSQL is used in the examples)

---

## Quick start

This is the shortest path to a working CRUD + auth app. For a full walkthrough,
follow the numbered steps in [docs/README.md](./docs/README.md) or look at the
run-ready [demo-api](./docs/demo-api/README.md).

### 1. Install the core libraries

```bash
pnpm add @nest-util/nest-crud@^2.0.1 @nest-util/nest-auth@^2.0.1 @nest-util/nest-error@^1.0.0
pnpm add @nestjs/typeorm typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

`@nest-util/nest-error` is required: the other packages import it at runtime.

### 2. Wire up TypeORM and the global pieces

Set `autoLoadEntities: true` — the libraries register their own entities this way.

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  autoLoadEntities: true, // required
  synchronize: process.env.NODE_ENV !== 'production',
});
```

In `main.ts`, turn on validation, the extended query parser (needed for filters),
and Swagger:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    transformOptions: { enableImplicitConversion: true },
  })
);

// deep filter[field_operator]=value objects parse correctly
app.getHttpAdapter().getInstance().set('query parser', 'extended');

const config = new DocumentBuilder()
  .setTitle('My API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### 3. Register the error system (once)

This gives every library a consistent, localized error body. Add it to your root
module:

```typescript
import { LocalizationModule } from '@nest-util/nest-error';
import errorMessages from './config/error-messages.json';

@Module({
  imports: [
    LocalizationModule.forRoot({
      messages: errorMessages, // { en: { ERROR_KEY: 'template' } }
      defaultLang: 'en',
      supportedLangs: ['en'],
      debug: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

See [libs/nest-error/README.md](./libs/nest-error/README.md) for the full details.

### 4. Build a resource

```typescript
// post.service.ts
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title'],
      include: ['author'],
    });
  }
}
```

```typescript
// post.controller.ts
const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

@ApiTags('post')
@Controller('post')
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

That single controller factory generates `findAll`, `findOne`, `create`,
`update`, and `remove`, plus filtering and pagination. Add `enableFindMine: true`
and configure `userOwnershipField` to get a user-scoped `GET /post/mine`.

### 5. Protect it with auth

```typescript
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase { /* ... */ }
```

Configure `AuthModule.forRoot(...)` once and use `@CurrentUser()`,
`@Permissions()`, `JwtAuthGuard`, and `PermissionsGuard` anywhere. The
[`nest-auth` guide](./docs/nest-auth/README.md) covers every endpoint and option.

### 6. Try it

```bash
# Create
curl -X POST http://localhost:3000/post \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","content":"World"}'

# List with pagination
curl "http://localhost:3000/post?page=1&limit=10"

# Filter
curl "http://localhost:3000/post?filter[title_cont]=Hello"

# Get one
curl http://localhost:3000/post/1
```

Swagger is available at `http://localhost:3000/api/docs`.

---

## What you get out of the box

### `nest-crud`

- Generic `NestCrudService` with TypeORM persistence
- `CreateNestedCrudController` endpoint factory
- Offset and cursor pagination
- Query filtering (`eq`, `cont`, `gte`, `lte`, `in`, and more)
- Lifecycle hooks with optional transaction wrapping
- Ownership enforcement and user-scoped `findMine`
- Status pipelines (declared transition graph)
- Approval pipelines (draft → submitted → approved/rejected)
- Audit logging (event bus + persistent `audit_logs` table)
- Generated test suites via `@nest-util/nest-crud/testing`

### `nest-auth`

- Registration, login, refresh, and logout
- JWT access tokens with refresh-token rotation
- Permissions and RBAC (`@Permissions()`, `PermissionsGuard`, roles)
- API-key authentication for server-to-server calls
- OTP login, password reset, account verification, and assisted onboarding
- Admin user management and self-service profile editing
- Rate limiting and per-account login lockout

### `nest-error`

- One stable `ErrorKey` per error
- Localized, generic messages (never leaking SQL or stack traces)
- A catch-all `LocalizedExceptionFilter` registered via `LocalizationModule`

---

## Running this repository

This is an [Nx](https://nx.dev) monorepo.

```bash
pnpm install

# PostgreSQL (also provides MinIO if you need file uploads)
./db.sh

# Run the demo API
npx nx serve demo-api
```

Useful commands:

```bash
npx nx graph                       # dependency graph
npx nx lint nest-crud              # lint one library
npx nx run-many -t build           # build everything
npx nx test nest-crud              # test one library
npx nx run-many -t test build lint typecheck --exclude=starter  # full check
```

---

## Documentation

- **[docs/README.md](./docs/README.md)** — documentation index and integration order
- **[demo-api](./docs/demo-api/README.md)** — how the example app is wired
- **[nest-crud](./docs/nest-crud/README.md)** — CRUD, pipelines, hooks, audit, testing
- **[nest-auth](./docs/nest-auth/README.md)** — auth, RBAC, OTP, reset, onboarding
- **[nest-error](./libs/nest-error/README.md)** — standardized error responses
- **[nest-file](./docs/nest-file/README.md)** — S3-compatible file management
- **[nest-notify](./docs/nest-notify/README.md)** — push + email notifications
- **[nest-payment](./docs/nest-payment/README.md)** — payments and subscriptions
- **[MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)** — upgrade an existing consumer app

---

## Contributing

Contributions are welcome. Fork the repository, create a feature branch, make your
changes with tests, and open a pull request.

---

## License

MIT
