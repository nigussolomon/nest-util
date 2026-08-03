---
name: nest-util
description: Use ONLY when working with @nest-util/nest-crud, @nest-util/nest-auth, or @nest-util/nest-notify packages. Use for NestJS CRUD scaffolding, JWT auth with RBAC, audit logging, hooks, cursor pagination, findMine, or FCM/SMTP notifications. Covers the entire nest-util monorepo.
---

# Nest-Util Skill

Complete reference for the `nest-util` Nx monorepo: a production-ready collection of NestJS libraries for CRUD operations, JWT authentication with RBAC, audit logging, lifecycle hooks, cursor pagination, and user-scoped record retrieval.

## Project Architecture

Nx monorepo (`pnpm workspaces`) with these packages:

| Package | Version | Purpose |
|---|---|---|
| `@nest-util/nest-crud` | 1.0.7 | Generic CRUD service + controller factory + audit + hooks + cursor pagination + findMine |
| `@nest-util/nest-auth` | 1.1.0 | JWT auth with RBAC, OTP, password reset, API key auth |
| `@nest-util/nest-notify` | 1.0.0 | FCM push + SMTP email notifications with device-token and history persistence |

**Key design**: Audit logging, lifecycle hooks, cursor pagination, and findMine are all built into `nest-crud`. No separate audit package exists.

**Integration order**: TypeORM → `AuthModule.forRoot(...)` → `NestCrudService` → `CreateNestedCrudController(...)` → global interceptors/filters.

---

## Package 1: `@nest-util/nest-crud`

### Exports

```typescript
// Module
export class NestCrudModule {}

// Service
export class NestCrudService<Entity extends ObjectLiteral, CreateDto, UpdateDto, ResponseDto>

// Controller factory
export function CreateNestedCrudController<CD, UD, RD>(
  createDto: Type<CD>,
  updateDto: Type<UD>,
  responseDto: Type<RD>,
  options?: CrudControllerFactoryOptions
): Type<IBaseController<CD, UD, RD>>

// Controller interface
export interface IBaseController<CD, UD, RD>
export type CrudEndpointPermissions = string | readonly string[]
export type CrudPermissionsMap = Partial<Record<CrudEndpoint, CrudEndpointPermissions>>
export interface CrudControllerFactoryOptions {
  permissions?: CrudPermissionsMap;
  enableFindMine?: boolean;
}
export const AUTH_PERMISSIONS_METADATA_KEY = 'auth:permissions'

// DTOs
export class FilterDto            // filter?: Record<string, unknown> with @Transform for nested query parsing
export class PaginationDto        // page?, limit?, orderBy?, orderDirection?
export class CursorPaginationDto  // cursor?, limit?, includeTotal?
export class ListAuditLogsDto     // user_id?, start_date?, end_date?, page?, limit?

// Decorators
export const MESSAGE_KEY = 'customMessage'
export const Message = (message: string) => ...
export const ENTITY_NAME_KEY = 'entityName'
export interface EntityNames { singular: string; plural: string }
export const EntityName = (names: string | EntityNames) => ...
export const AUDIT_METADATA_KEY = 'nest_util_audit'
export interface AuditOptions { action: string; entity?: string }
export const Audit = (options: AuditOptions) => ...

// Interceptors
export class ResponseInterceptor   // wraps { message, data, meta, status: 'success' }
export class AuditInterceptor      // intercepts @Audit() decorated handlers

// Interfaces
export type CrudEndpoint = 'findAll' | 'findOne' | 'create' | 'update' | 'remove' | 'findAuditLogs' | 'findMine'
export interface AuditLogQuery { user_id?, start_date?, end_date?, page?, limit? }
export interface CrudInterface<CreateDto, UpdateDto, ResponseDto>
export interface CursorPaginationResult<T> { data: T[]; meta: { limit, hasMore, nextCursor, total? } }
export interface CursorStrategy { type: 'integer' | 'uuid'; timestampColumn?: string }
export interface FindMineConfig<TEntity> { userOwnershipField?: keyof TEntity; findMineQuery?: ... }

// Hooks
export type CrudHook<TContext> = (context: TContext) => Promise<any> | any
export interface CrudHookConfig<TContext> { handler: CrudHook<TContext>; transaction?: boolean }
export interface CrudHooks<TEntity, TCreateDto, TUpdateDto> { beforeCreate?, afterCreate?, ... }
export interface TransactionConfig { isolationLevel?: ...; timeout?: number }

// Entities
export class AuditLogEntity  // table: audit_logs, PrimaryGeneratedColumn('uuid')

// Services
export class AuditService { log(), logEntityAction(), findAll() }

// Exception filter
export class TypeOrmExceptionFilter  // catches QueryFailedError: 23505→422, 1062→422

// Helpers
export function applyFilters(qb, filters, allowedFilters)
export function applyPagination(qb, query)
export function decodeCursor(raw, strategy)
export function applyCursorFilter(qb, decoded, strategy, orderDirection)
export function buildNextCursor(entities, strategy)
export function detectCursorStrategy(repository)
```

### `NestCrudService` API

```typescript
interface CrudServiceOptions<Entity, ResponseDto> extends FindMineConfig<Entity> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity)[];      // whitelist filterable fields
  allowedSortFields?: readonly (keyof Entity)[];   // whitelist sortable fields
  include?: readonly string[];                     // joined relations (e.g. ['author']). Supports nested dot-notation: ['userRoles.role'] → { userRoles: { role: true } }
  relations?: {                                     // resolve foreign key IDs → entities
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;                              // defaults to `${property}Id`
  }[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
  disabledEndpoints?: readonly CrudEndpoint[];      // disable specific generated routes
  cursorStrategy?: CursorStrategy;                  // override auto-detection
  hooks?: CrudHooks<Entity, any, any>;              // lifecycle hooks
  transactionConfig?: TransactionConfig;            // isolation level for transactional hooks
  userOwnershipField?: keyof Entity;                // enables findMine with simple column match
  findMineQuery?: (qb, userId) => void;             // enables findMine with custom query
}
```

**Methods**:
- `findAll(query: PaginationDto & FilterDto)` → `{ data: ResponseDto[], meta?: { page, limit, total } }`
- `findAllWithCursor(query: CursorPaginationDto & FilterDto)` → `CursorPaginationResult<ResponseDto>`
- `findOne(id: number)` → `ResponseDto`
- `create(payload: CreateDto)` → `ResponseDto`
- `update(id: number, payload: UpdateDto)` → `ResponseDto`
- `remove(id: number)` → `boolean`
- `findMine(userId, query)` → `{ data: ResponseDto[], meta?: ... }`
- `findAuditLogs(query: AuditLogQuery)` → `{ data: AuditLogEntity[], meta: { total, page, limit, totalPages } }`

**`relations` option behavior**: When `relations` is configured, `create` and `update` will:
1. Look for a payload field named `${property}Id` (or custom `idField`)
2. Fetch the related entity from the given repository
3. Assign it to `payload[property]`
4. Delete the `${property}Id` field from the payload

### `CreateNestedCrudController` Generated Endpoints

| Endpoint | Method | Decorators | Permission Key |
|---|---|---|---|
| `GET /` (findAll) | `@Get()` | `@Message('fetched')`, `@ApiQuery` for filters/pagination/cursor | `findAll` |
| `GET /mine` (findMine) | `@Get('mine')` | `@Message('fetched')`, `@CurrentUser()` | `findMine` |
| `GET /:id` (findOne) | `@Get(':id')` | `@Message('fetched')` | `findOne` |
| `POST /` (create) | `@Post()` | `@Message('created')`, `@Audit({action:'CREATE'})`, `@ApiBody(createDto)` | `create` |
| `PATCH /:id` (update) | `@Patch(':id')` | `@Message('updated')`, `@Audit({action:'UPDATE'})`, `@ApiBody(updateDto)` | `update` |
| `DELETE /:id` (remove) | `@Delete(':id')` | `@Message('deleted')`, `@Audit({action:'DELETE'})` | `remove` |
| `GET /auditlogs` | `@Get('auditlogs')` | `@Message('fetched')` | `findAuditLogs` |

**All endpoints check `service.disabledEndpoints`** and throw `NotFoundException` if disabled.

**`permissions` option**: When `CrudControllerFactoryOptions.permissions` is provided, the factory calls `applyPermissionMetadata()` which sets `AUTH_PERMISSIONS_METADATA_KEY` (`'auth:permissions'`) on the handler method via `Reflect.defineMetadata`. This is the same key used by `PERMISSIONS_KEY` from nest-auth, meaning `PermissionsGuard` will pick these up automatically.

### Filtering System

**Query format**: `?filter[field_operator]=value` — requires Express `query parser` set to `extended`:
```typescript
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

**Supported operators** (applied via `applyFilters()` in `filter.helper.ts`):
- `eq` — Equals (`e.field = :val`)
- `ne` — Not equals (`e.field != :val`)
- `cont` — Contains, case-insensitive (`e.field ILIKE '%val%'`)
- `notcont` — Not contains (`e.field NOT ILIKE '%val%'`)
- `starts` — Starts with (`e.field ILIKE 'val%'`)
- `ends` — Ends with (`e.field ILIKE '%val'`)
- `gte` — Greater than or equal (`e.field >= :val`)
- `lte` — Less than or equal (`e.field <= :val`)
- `gt` — Greater than (`e.field > :val`)
- `lt` — Less than (`e.field < :val`)
- `in` — In list (`e.field IN (:...val)`) — comma-separated values
- `nin` — Not in list (`e.field NOT IN (:...val)`) — comma-separated values
- `isnull` — IS NULL (`true`), IS NOT NULL (`false`)

**Grouping**:
- `filter[and][0][field_eq]=val&filter[and][1][other_eq]=val2` → AND group
- `filter[or][0][field_eq]=val&filter[or][1][other_eq]=val2` → OR group
- Groups can be nested arbitrarily

**Nested (related) fields**: Use dot notation — `filter[author.name_cont]=John`. Requirements:
1. The join prefix must be listed in `include` (e.g. `include: ['author']`); nested prefixes resolve to the joined alias (`author.name` → `author.name`, `author.profile.bio` → `author_profile.bio`)
2. The full path must be whitelisted in `allowedFilters` (e.g. `allowedFilters: ['author.name']`)
3. A nested filter whose join prefix is missing from `include` is silently skipped
- Nested sorting works the same way via `orderBy=author.name` + `allowedSortFields`

**Safety**: Field names validated against `/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/`. Only `allowedFilters` fields are processed.

### Pagination

#### Offset-based (default)

`PaginationDto` fields: `page` (default 1, min 1), `limit` (default 10, min 1), `orderBy`, `orderDirection` ('ASC' | 'DESC', default 'DESC').

`applyPagination()` only applies `skip()`/`take()` when both `page` and `limit` are provided. If absent, no pagination is applied (returns all results).

Sorting via `orderBy` only works if field is in `allowedSortFields` (or if `allowedSortFields` is empty, any field is allowed). Nested sort fields (`orderBy=author.name`) also require the join prefix to be in `include`. Cursor pagination keeps its fixed `id` ordering.

#### Cursor-based

Pass `?cursor=<opaque>` to any `GET /` endpoint to switch to cursor pagination automatically.

`CursorPaginationDto` fields: `cursor` (opaque string), `limit` (1-100, default 10), `includeTotal` (boolean, default false).

**Cursor strategy detection**: Integer primary keys use simple `id > cursor`. UUID primary keys (like `AuditLogEntity`) use composite `(createdAt, id)` cursors. Auto-detected from repository metadata, or override with `cursorStrategy` option.

**Response shape**:
```json
{
  "data": [...],
  "meta": {
    "limit": 10,
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTB9",
    "total": 42
  }
}
```

`total` only present when `?includeTotal=true` is passed.

### Lifecycle Hooks

Configure hooks in `CrudServiceOptions`:

```typescript
super({
  repository,
  hooks: {
    beforeCreate: {
      handler: async (ctx) => {
        // ctx.payload — the create DTO
      },
      transaction: true,  // runs inside a DB transaction
    },
    afterCreate: {
      handler: async (ctx) => {
        // ctx.entity — the saved entity
        // ctx.payload — the original DTO
      },
    },
  },
  transactionConfig: {
    isolationLevel: 'READ COMMITTED',  // or REPEATABLE READ, SERIALIZABLE, etc.
  },
});
```

**Available hooks**:

| Hook | Context | Timing |
|---|---|---|
| `beforeCreate` | `{ payload }` | Before `repo.save()` |
| `afterCreate` | `{ entity, payload }` | After `repo.save()`. **`payload` is a snapshot of the original DTO before relation resolution.** |
| `beforeUpdate` | `{ payload, entity, id }` | Before `repo.merge()` + `repo.save()` |
| `afterUpdate` | `{ entity, payload, id }` | After `findOne()` re-fetch. **`payload` is a snapshot of the original DTO before relation resolution.** |
| `beforeRemove` | `{ entity, id }` | Before `repo.delete()` |
| `afterRemove` | `{ id, deleted }` | After `repo.delete()` |
| `beforeFindOne` | `{ id }` | Before `repo.findOne()` |
| `afterFindOne` | `{ entity, id }` | After `repo.findOne()` |

**Transaction behavior**: When `transaction: true`, the hook handler runs inside a `QueryRunner` transaction with the configured isolation level. If the hook throws, the transaction rolls back.

### findMine (User-Scoped Records)

Two configuration modes:

**Simple column match** — when all user-owned records have a direct foreign key:

```typescript
super({
  repository,
  userOwnershipField: 'authorId',  // WHERE e.authorId = :userId
});
```

**Custom query** — for complex ownership (e.g., author OR collaborator):

```typescript
super({
  repository,
  findMineQuery: (qb, userId) => {
    qb.where('e.authorId = :userId', { userId })
      .orWhere('e.id IN (SELECT postId FROM post_collaborators WHERE userId = :userId)', { userId });
  },
});
```

Controller must have `enableFindMine: true`:

```typescript
const PostControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post,
  { enableFindMine: true }
);
```

**Endpoint**: `GET /resource/mine` — requires authentication (`@CurrentUser()`), returns user-scoped records with standard pagination.

### Audit Logging

`AuditInterceptor` logs actions for handlers decorated with `@Audit()`. CRUD controller factory auto-decorates `create`, `update`, `remove`.

```typescript
// Manual decoration
@Post()
@Audit({ action: 'CREATE', entity: 'Post' })
create(@Body() dto: CreatePostDto) { ... }
```

`AuditLogEntity` stores: `action`, `entity`, `entityId`, `userId`, `tenantId`, `metadata` (JSONB), `ip`, `userAgent`, `createdAt`.

`NestCrudService.findAuditLogs()` queries audit logs filtered by entity name, with optional `user_id`, date range, and pagination.

### Response Wrapping

`ResponseInterceptor` transforms all responses into:
```json
{
  "message": "{EntityPlural} {action} successfully",
  "data": ...,
  "meta": { ... },
  "status": "success"
}
```

`@Message('verb')` sets the action word on the handler. `@EntityName({ singular: 'Post', plural: 'Posts' })` sets the entity name on the controller. If data is an array or has `.data` property that is an array, plural is used; otherwise singular. Fallback: `Action: 'Request successful'`, `Name: 'Resource'/'Resources'`.

### Error Handling

`TypeOrmExceptionFilter` catches `QueryFailedError`:
- Postgres code `23505` → 422 with `"Duplicate entry: ..."` message
- MySQL errno `1062` → 422 with `"Duplicate entry: ..."` message
- All other DB errors → 500 with `"Internal server error"`
- Uses `driverError.detail` for more specific message if available

---

## Package 2: `@nest-util/nest-auth`

### Exports

```typescript
// Module
export class AuthModule { static forRoot(options: AuthModuleOptions): DynamicModule }
export const AUTH_OPTIONS = 'AUTH_OPTIONS'

// Service
export class AuthService {
  register(data): Promise<AuthUser>
  login(credentials): Promise<AuthTokens>
  requestOtp(data): Promise<{success, message?}>
  loginWithOtp(credentials): Promise<AuthTokens>
  refresh(refreshToken): Promise<AuthTokens>
  logout(userId): Promise<boolean>
  changePassword(userId, currentPassword, newPassword): Promise<{success, message}>
  requestPasswordReset(data): Promise<{success, message?}>
  resetPassword(token, newPassword): Promise<{success, message}>
  createRole(data: CreateRoleDto): Promise<RoleEntity>
  assignRoleToUser(userId, roleId): Promise<RoleEntity>
  assignPermissionsToRole(roleId, permissions): Promise<RoleEntity>
  removePermissionsFromRole(roleId, permissions): Promise<RoleEntity>
  removeRoleFromUser(userId, roleId): Promise<boolean>
  getUserRoles(userId): Promise<RoleEntity[]>
  getAllRoles(): Promise<RoleEntity[]>
  validateUser(payload: {sub, nonce}): Promise<AuthUser | null>
}

// Controller factory
export function CreateAuthController(options: AuthModuleOptions): Type<unknown>

// Guards
export class JwtAuthGuard       // extends AuthGuard('jwt'), skips @Public() routes
export class PermissionsGuard    // checks @Permissions() vs resolved user permissions
export class RouteDisabledGuard  // blocks configured disabled routes
export class JwtStrategy         // Passport JWT strategy with nonce validation

// Decorators
export const Public = () => ...        // marks route as public (skips JWT)
export const CurrentUser = () => ...   // param decorator, extracts request.user
export const Permissions = (...permissions: string[]) => ...  // sets required permissions
export const AuthOptions = () => ...   // injects AUTH_OPTIONS token

// Interfaces
export interface AuthModuleOptions
export interface AuthOtpOptions
export interface AuthPasswordResetOptions
export interface OtpDeliveryPayload
export type OtpDeliveryCallback
export class AuthUser { id, permissions?, roles?, [key: string]: unknown }
export interface AuthTokens { access_token, refresh_token, user: AuthUser }
export interface AuthRbacOptions
export interface PermissionEvaluationContext
export interface PermissionRegistryConfig
export interface PermissionRegistryResource
export interface ResolvedPermissionRegistry
export type CrudRegistryEndpoint
export type CrudEndpointActions
export interface BuildCrudPermissionsOptions

// Entities
export class RoleEntity    // id, name(unique), description, permissions(simple-array), isSystem, timestamps
export class UserRoleEntity // id, userId, roleId, role(eager ManyToOne), timestamps

// DTOs
export class CreateRoleDto       // name(required), description?, permissions?
export class RolePermissionsDto  // permissions: string[] (non-empty)

// Helpers
export const resolvePermissions = (user: AuthUser, rbacOptions?: AuthRbacOptions): string[]
export const resolvePermissionRegistry = (registry?: PermissionRegistryConfig): ResolvedPermissionRegistry
export const buildCrudPermissionsFromRegistry = (registry, options): Partial<Record<CrudRegistryEndpoint, string>>
```

### `AuthModule.forRoot()` Configuration

```typescript
interface AuthModuleOptions {
  userEntity: Type<unknown>;              // REQUIRED: Your User entity class
  identifierField: string;                // REQUIRED: Login field (e.g. 'email', 'username')
  passkeyField: string;                   // REQUIRED: Password field (e.g. 'password')
  jwtSecret: string;                      // REQUIRED: JWT signing secret
  expiresIn?: string;                     // default: '1h'
  refreshTokenSecret?: string;           // default: same as jwtSecret
  refreshTokenExpiresIn?: string;        // default: '7d'
  refreshTokenField?: string;            // default: 'refreshToken' (DB field for hashed refresh nonce)
  accessTokenField?: string;             // default: 'accessToken' (DB field for hashed access nonce)
  refreshTokenHeaderName?: string;       // default: 'x-refresh-token'
  disabledRoutes?: string[];             // e.g. ['register', 'otp/request']
  loginDto?: Type<unknown>;
  registerDto?: Type<unknown>;
  refreshDto?: Type<unknown>;
  relations?: string[];                  // loaded during JWT validation (e.g. ['userRoles', 'userRoles.role'])
  rbac?: AuthRbacOptions;
  permissionRegistry?: PermissionRegistryConfig;
  otp?: AuthOtpOptions;
  passwordReset?: AuthPasswordResetOptions;
  onboarding?: AuthOnboardingOptions;
}
```

Auth module is `@Global()`. It automatically registers: `PassportModule`, `JwtModule`, `TypeOrmModule.forFeature([userEntity, RoleEntity, UserRoleEntity])`, and all providers/guards. Exports `AUTH_OPTIONS`, `JwtModule`, `PassportModule`, `TypeOrmModule`, `AuthService`, all guards, and `Reflector`.

### Token Rotation Mechanism

Access and refresh tokens carry a `nonce` (UUID v4). On generation, the nonce is bcrypt-hashed and stored in the user entity's `accessToken` and `refreshToken` fields. Validation:
1. JWT payload extracted → nonce compared via `bcrypt.compare()` against stored hash
2. On refresh, the old refresh nonce is verified, then BOTH new access and new refresh tokens are issued (with new nonces), overwriting both stored hashes
3. On logout, both `accessToken` and `refreshToken` fields are set to `null`
4. On password reset, both token fields are also cleared

**This means**: each refresh invalidates both previous tokens → single-session enforcement.

### RBAC System

```typescript
interface AuthRbacOptions {
  directPermissionsKey?: string;     // default: 'permissions' — key on user for direct permissions
  rolesKey?: string;                 // default: 'roles' — key on user for role assignments
  userRolesRelation?: string;        // relation name to eager-load (e.g. 'userRoles')
  rolePermissionsKey?: string;       // default: 'permissions' — key on role for its permissions
  nestedRoleKey?: string;            // default: 'role' — key on userRole row for the actual Role
  requireAllPermissions?: boolean;   // default: true — false = any match suffices
  permissionEvaluator?: (context: PermissionEvaluationContext) => boolean | Promise<boolean>;
}
```

**Permission resolution** (`resolvePermissions()`):
1. Collects `user[directPermissionsKey]` (string array)
2. Iterates `user[rolesKey]` (object array — user-role rows)
3. For each role-like object, collects `roleLike[rolePermissionsKey]` (direct role perms)
4. Also checks `roleLike[nestedRoleKey]` (the actual role object) and collects `nestedRole[rolePermissionsKey]`
5. Returns deduplicated flat `string[]`

**PermissionsGuard** flow:
1. Skip if route has `@Public()` decorator (class or handler level)
2. Read `@Permissions(...)` from handler and class metadata → `requiredPermissions`
3. If no required permissions → allow
4. If `permissionEvaluator` is configured → delegate to it
5. Otherwise: if `requireAllPermissions` (default) → `every()`, else → `some()`
6. On failure → `ForbiddenException('Missing required permissions')`

### Permission Registry

```typescript
interface PermissionRegistryConfig {
  resources: readonly PermissionRegistryResource[];
}
interface PermissionRegistryResource {
  resource: string;
  permissions: readonly string[];
}
```

`buildCrudPermissionsFromRegistry(registry, options)` generates a permissions map for CRUD endpoints. Default endpoint actions:
- `findAll` → `read`, `findOne` → `readOne`, `create` → `create`, `update` → `update`, `remove` → `delete`, `findAuditLogs` → `audit`, `findMine` → `read`

Permission keys are built as `{resource}.{action}` (e.g. `posts.create`). If `strict` is not false and a permission is missing from the registry, an error is thrown at startup.

`admin.access` is always automatically added to the resolved permission list.

### Auth Endpoints (Generated by `CreateAuthController()`)

| Route | Method | Auth Required | Description |
|---|---|---|---|
| `POST /auth/register` | Post | No | Register new user (checks `disabledRoutes`) |
| `POST /auth/login` | Post | No | Login with credentials |
| `POST /auth/otp/request` | Post | No | Request OTP code |
| `POST /auth/otp/login` | Post | No | Login with OTP code |
| `POST /auth/refresh` | Post | No | Refresh access token |
| `GET /auth/me` | Get | JwtAuthGuard | Current user profile |
| `POST /auth/update-password` | Post | JwtAuthGuard | Change own password |
| `POST /auth/password-reset/request` | Post | No | Request password reset token |
| `POST /auth/password-reset/reset` | Post | No | Reset password with token |
| `GET /auth/me/permissions` | Get | JwtAuthGuard | Get effective permissions |
| `POST /auth/logout` | Post | JwtAuthGuard | Invalidate tokens |
| `GET /auth/permissions` | Get | JwtAuthGuard + PermissionsGuard(`admin.access`) | Permission catalog |
| `POST /auth/roles` | Post | JwtAuthGuard + PermissionsGuard(`admin.access`) | Create role |
| `GET /auth/roles` | Get | JwtAuthGuard + PermissionsGuard(`admin.access`) | List all roles |
| `POST /auth/users/:userId/roles/:roleId` | Post | JwtAuthGuard + PermissionsGuard(`admin.access`) | Assign role to user |
| `DELETE /auth/users/:userId/roles/:roleId` | Delete | JwtAuthGuard + PermissionsGuard(`admin.access`) | Remove role from user |
| `POST /auth/roles/:roleId/permissions` | Post | JwtAuthGuard + PermissionsGuard(`admin.access`) | Add permissions to role |
| `DELETE /auth/roles/:roleId/permissions` | Delete | JwtAuthGuard + PermissionsGuard(`admin.access`) | Remove permissions from role |
| `GET /auth/users/:userId/roles` | Get | JwtAuthGuard + PermissionsGuard(`admin.access`) | Get user's roles |
| `POST /auth/onboarding/start` | Post | JwtAuthGuard + PermissionsGuard(`onboarding.start`) | Agent starts assisted onboarding (sends OTP to invitee) |
| `POST /auth/onboarding/complete` | Post | JwtAuthGuard + PermissionsGuard(`onboarding.complete`) | Agent enters invitee's OTP, receives single-use `onboarding_token` |
| `POST /auth/onboarding/user` | Post | OnboardingJwtGuard only | Creates the user from the onboarding attempt (runs `registerHooks`) |

All `/auth` endpoints check `options.disabledRoutes` before executing; if the route name is in the list, `ForbiddenException` is thrown.

### OTP Configuration

```typescript
interface AuthOtpOptions {
  enabled?: boolean;
  codeLength?: number;           // default: 6 (must be 4-10)
  ttlSeconds?: number;           // default: 300 (5 min)
  cooldownSeconds?: number;      // default: 60
  maxAttempts?: number;          // default: 5 (before lock)
  lockSeconds?: number;          // default: 300
  channel?: string;              // default: 'email'
  codeField?: string;            // default: 'otpCodeHash' — DB field for hashed code
  expiresAtField?: string;       // default: 'otpCodeExpiresAt'
  attemptsField?: string;        // default: 'otpRequestAttempts'
  lastSentAtField?: string;      // default: 'otpLastSentAt'
  lockUntilField?: string;       // default: 'otpLockedUntil'
  inputCodeField?: string;       // default: 'otpCode' — request body field name
  requestDto?: Type<unknown>;    // DTO for request endpoint
  loginDto?: Type<unknown>;      // DTO for login endpoint
  metadata?: Record<string, unknown>;
  buildDeliveryContext?: (params: { identifier, user? }) => Record<string, unknown>;
  deliverCode?: OtpDeliveryCallback;  // REQUIRED if otp.enabled
}

type OtpDeliveryCallback = (payload: OtpDeliveryPayload) => Promise<void>
interface OtpDeliveryPayload {
  identifier: string;
  code: string;
  channel: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
}
```

Your User entity must have fields for: `otpCodeHash`, `otpCodeExpiresAt`, `otpRequestAttempts`, `otpLastSentAt`, `otpLockedUntil` (or custom field names).

### Assisted Onboarding Configuration

Opt-in agent-assisted onboarding. An agent starts the flow on behalf of an invitee (OTP is sent to the invitee), the agent enters the invitee's OTP to complete it and receives a **single-purpose onboarding JWT** that can only be used on `POST /auth/onboarding/user` to create the user. No password is ever set; created users log in with OTP.

```typescript
interface AuthOnboardingOptions {
  enabled?: boolean;
  codeLength?: number;            // default: 6 (must be 4-10)
  ttlSeconds?: number;            // default: 300 (5 min)
  cooldownSeconds?: number;       // default: 60
  maxAttempts?: number;           // default: 5 (before lock)
  lockSeconds?: number;           // default: 300
  channel?: string;               // default: 'email'
  onboardingTokenSecret?: string; // default: same as jwtSecret
  onboardingTokenExpiresIn?: string; // default: '15m'
  startDto?: Type<unknown>;       // body: { [identifierField]: string, password?: never }
  completeDto?: Type<unknown>;    // body: { [identifierField]: string, code: string }
  createUserDto?: Type<unknown>;  // body: { [identifierField]: string, password?: never }
  metadata?: Record<string, unknown>;
  buildDeliveryContext?: (params: { identifier }) => Record<string, unknown>;
  deliverCode?: OnboardingDeliveryCallback;  // REQUIRED if onboarding.enabled
}
```

Attempt state lives on a dedicated `OnboardingAttemptEntity` (not the User row) because the user does not exist until the final step. The entity uses a partial unique index on `(identifierField, identifier)` where `consumedAt IS NULL` so only one pending attempt can exist per identifier. Permissions are fixed convention: `onboarding.start` and `onboarding.complete` (via `@Permissions` + `PermissionsGuard`).

Flow:
1. Agent: `POST /auth/onboarding/start` `{ email }` → OTP delivered to invitee (rate-limited like OTP login)
2. Agent: `POST /auth/onboarding/complete` `{ email, code }` → `{ onboarding_token }` (single-use, expires in `onboardingTokenExpiresIn`)
3. Agent: `POST /auth/onboarding/user` with `Authorization: Bearer <onboarding_token>` → user created with `registerHooks` + `verifiedAt`, attempt consumed

### Password Reset Configuration

```typescript
interface AuthPasswordResetOptions {
  enabled?: boolean;
  tokenLength?: number;          // default: 64
  tokenTtlSeconds?: number;      // default: 3600
  tokenField?: string;           // default: 'passwordResetTokenHash'
  expiresAtField?: string;       // default: 'passwordResetTokenExpiresAt'
  requestDto?: Type<unknown>;
  resetDto?: Type<unknown>;
  buildResetContext?: (params: { identifier, user? }) => Record<string, unknown>;
  deliverToken?: (payload: { identifier, token, expiresAt, metadata?, context? }) => Promise<void>;
}
```

### Important Security Behaviors

- `register()` does NOT return the password, refresh token, or access token fields (stripped via `removeSensitiveData()`)
- `login()` uses `addSelect()` to explicitly select password field; `findOne` with `where` object for identifier
- `requestOtp()` returns same success message whether user exists or not (prevents account enumeration)
- `requestPasswordReset()` also returns success for non-existent users
- `resetPassword()` invalidates all existing sessions (clears both token fields)
- `validateUser()` eager-loads relations via `leftJoinAndSelect` to build full RBAC context
- `onboarding/user` creates users with no password and never returns token fields; the onboarding JWT has `type: 'onboarding'`, is single-use (attempt `consumedAt`), and only guards the create endpoint
- All sensitive fields (password, tokens, OTP fields) are stripped from response via `removeSensitiveData()`

---

## Package 3: `@nest-util/nest-notify`

### Exports

```typescript
// Module
export class NestNotifyModule { static forRoot(options: NestNotifyOptions): DynamicModule }

// Services
export class NotifyService {
  registerDeviceToken(userId, token, platform, deviceId?)
  unregisterDeviceToken(userId, token)
  listDeviceTokens(userId): Promise<DeviceTokenEntity[]>
  push(userId, payload: PushPayload): Promise<SendPushResult>   // sends + records history + prunes dead tokens
  pushToToken(token, payload: PushPayload)
  email(payload: EmailPayload, userId?): Promise<{ success }>
  getNotifications({ userId, channel?, page?, limit? })
}
export class FcmService    // sendToToken, sendToTokens (batches of 500), getDeadTokens
export class EmailService  // send(payload)

// Controller factory
export function CreateNotifyController(options?: NotifyControllerOptions): abstract class
export interface NotifyControllerOptions { permissions?: { devices?, push?, email?, history? } }

// Entities
export class DeviceTokenEntity   // table: device_tokens, unique token, indexed userId
export class NotificationEntity  // table: notifications, channel/provider/status/title/body/subject/to/error/metadata(jsonb)/sentAt

// Options
export interface NestNotifyOptions {
  fcm?: { enabled?, app?, projectId?, clientEmail?, privateKey? };
  smtp?: { enabled?, transport?, host?, port?, secure?, user?, pass?, from?: { name?, address } };
  controller?: { enable?, path?, permissions?: { devices?, push?, email?, history? } };
}

// Payloads
export interface PushPayload { title: string; body: string; imageUrl?, clickAction?, data? }
export interface EmailPayload { to; subject; text?; html?; cc?; bcc?; replyTo? }
export interface PushResult { token; success; code? }
export interface SendPushResult { successCount; failureCount; results: PushResult[] }
```

### `NestNotifyModule.forRoot()` Configuration

- `fcm.enabled: true` requires **either** `fcm.app` (pre-initialized firebase-admin App) **or** `fcm.projectId` + `fcm.clientEmail` + `fcm.privateKey` — otherwise `FcmService` throws at construction.
- `smtp.enabled: true` requires **either** `smtp.transport` (pre-built nodemailer transport) **or** `smtp.host` + `smtp.port` + `smtp.from.address` — otherwise `EmailService` throws at construction.
- The module is `@Global()`; the auto controller is registered at `controller.path` (default `'notify'`) guarded with `JwtAuthGuard` + `PermissionsGuard`. Requires `@nest-util/nest-auth` installed (uses `@CurrentUser()`).
- When `controller.permissions` is provided, permission metadata (`AUTH_PERMISSIONS_METADATA_KEY`) is set on each handler — `PermissionsGuard` picks these up automatically.

### Auto-Registered Endpoints

| Endpoint | Method | Auth | Permission Key |
|---|---|---|---|
| `POST /notify/devices` | POST | JWT+Perm | `devices` |
| `GET /notify/devices` | GET | JWT+Perm | `devices` |
| `DELETE /notify/devices` | DELETE | JWT+Perm | `devices` |
| `POST /notify/push` | POST | JWT+Perm | `push` |
| `POST /notify/email` | POST | JWT+Perm | `email` |
| `GET /notify/history` | GET | JWT+Perm | `history` |

`push`/`email` default to the authenticated user via `userId` optional body field. History is always scoped to the authenticated user.

### Dead-Token Pruning

FCM responses with dead-token codes (`messaging/registration-token-not-registered`, `messaging/invalid-registration-token`, `messaging/invalid-argument`, `messaging/mismatched-credential`) are collected by `FcmService.getDeadTokens()`; `NotifyService.push()` deletes those rows from `device_tokens` via `In(deadTokens)` after sending. FCM `sendEach` batches at most 500 messages per call.

---

## Common Usage Patterns

### Complete Module Setup (from demo-api)

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  // Swagger setup with DocumentBuilder + .addBearerAuth() + SwaggerModule.setup('api/docs', app, document)
  app.getHttpAdapter().getInstance().set('query parser', 'extended');
  app.useGlobalFilters(new TypeOrmExceptionFilter());
  await app.listen(process.env.PORT || 3000);
}

// app.module.ts
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres', host, port, username, password, database,
      autoLoadEntities: true, synchronize: true, // synchronize: false in production!
    }),
    TypeOrmModule.forFeature([Post, Comment]),
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: '...',
      refreshTokenField: 'refreshToken',
      accessTokenField: 'accessToken',
      loginDto: LoginDto, registerDto: RegisterDto, refreshDto: RefreshDto,
      relations: ['userRoles', 'userRoles.role'],
      rbac: { userRolesRelation: 'userRoles', rolesKey: 'userRoles', nestedRoleKey: 'role' },
      permissionRegistry,
      otp: { enabled: true, deliverCode: async ({ identifier, code }) => { /* send */ } },
      passwordReset: { enabled: true, deliverToken: async ({ identifier, token }) => { /* send */ } },
    }),
    NestCrudModule,
    PostModule, CommentModule, UserModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
```

### Protected CRUD Controller with Permissions

```typescript
const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, { resource: 'posts' }),
  }
) as abstract new (service: PostService) => IBaseController<CreatePostDto, UpdatePostDto, Post>;

@ApiTags('post')
@Controller('post')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

### CRUD Controller with findMine

```typescript
const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, { resource: 'posts' }),
    enableFindMine: true,
  }
) as abstract new (service: PostService) => IBaseController<CreatePostDto, UpdatePostDto, Post>;

@ApiTags('post')
@Controller('post')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
```

### Public CRUD Controller (No Auth)

```typescript
@ApiTags('comment')
@Controller('comment')
export class CommentController
  extends CreateNestedCrudController(CreateCommentDto, UpdateCommentDto, Comment)
  implements IBaseController<CreateCommentDto, UpdateCommentDto, Comment>
{
  constructor(override readonly service: CommentService) {
    super(service);
  }
}
```

### Custom CRUD Service with Response DTO

```typescript
@Injectable()
export class UsersService extends NestCrudService<User, CreateUserDto, UpdateUserDto, UserResponseDto> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super({
      repository,
      allowedFilters: ['email', 'id'],
      allowedSortFields: ['id', 'email', 'createdAt'],
      include: ['userRoles', 'userRoles.role'],
      toResponseDto: (entity) => {
        const user = entity as User;
        const { password, refreshToken, accessToken, ...safe } = user;
        return safe as unknown as UserResponseDto;
      },
    });
  }
}
```

### Service with Hooks

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      hooks: {
        beforeCreate: {
          handler: async (ctx) => {
            // Validate or transform payload before save
            ctx.payload.title = ctx.payload.title.trim();
          },
        },
        afterCreate: {
          handler: async (ctx) => {
            // Send notification, emit event, etc.
            await this.notificationService.notify('post.created', ctx.entity);
          },
        },
        beforeRemove: {
          handler: async (ctx) => {
            // Check if deletion is allowed
            if (ctx.entity.published) {
              throw new BadRequestException('Cannot delete published post');
            }
          },
          transaction: true,
        },
      },
      transactionConfig: {
        isolationLevel: 'READ COMMITTED',
      },
    });
  }
}
```

### Service with findMine

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      userOwnershipField: 'authorId',
    });
  }
}
```

### Service with Custom findMine Query

```typescript
@Injectable()
export class PostService extends NestCrudService<Post, CreatePostDto, UpdatePostDto> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      findMineQuery: (qb, userId) => {
        qb.where('e.authorId = :userId', { userId })
          .orWhere(
            'e.id IN (SELECT postId FROM post_collaborators WHERE userId = :userId)',
            { userId }
          );
      },
    });
  }
}
```

### Custom Endpoint + @CurrentUser

```typescript
@Controller('post')
export class PostController extends CreateNestedCrudController(...)
  implements IBaseController<CreatePostDto, UpdatePostDto, Post> {

  @Get('my-posts')
  @Message('fetched my posts')
  async getMyPosts(@CurrentUser() user: AuthUser) {
    return this.service.findAll({ filter: { authorId_eq: user.id } });
  }
}
```

### Disabling Specific Endpoints

```typescript
super({
  repository,
  disabledEndpoints: ['remove', 'findAuditLogs', 'findMine'],  // disable DELETE, audit logs, and mine
});
```

### Resolving Foreign Keys with `relations` Option

```typescript
super({
  repository: postRepo,
  relations: [
    { property: 'author', repo: userRepo, idField: 'authorId' },
    { property: 'category', repo: categoryRepo },  // idField defaults to 'categoryId'
  ],
});
// Now when creating a Post with { title: '...', authorId: 5 }, the service:
// 1. Fetches User with id=5 from userRepo
// 2. Sets post.author = fetchedUser
// 3. Deletes post.authorId from the payload before save
```

### Permission Registry Example

```typescript
// permission-registry.ts
import { PermissionRegistryConfig } from '@nest-util/nest-auth';

export const permissionRegistry: PermissionRegistryConfig = {
  resources: [
    {
      resource: 'posts',
      permissions: ['read', 'create', 'update', 'delete'],
    },
    {
      resource: 'users',
      permissions: ['read', 'update', 'delete'],
    },
  ],
};
```

### Auth DTOs with Swagger

```typescript
export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;
  @ApiProperty({ example: 'password123' })
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;
  @ApiProperty({ example: 'password123' })
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  refreshToken!: string;
}
```

---

## Required User Entity Fields

For `AuthModule` to work, your User entity must have these fields (naming is configurable):
- **Identifier field** (default: `email`) — used for login lookup
- **Password field** (default: `password`) — bcrypt-hashed, should have `@Column({ select: false })` to prevent leaking
- **Refresh token field** (default: `refreshToken`) — stores bcrypt hash of refresh nonce, `@Column({ select: false, nullable: true })`
- **Access token field** (default: `accessToken`) — stores bcrypt hash of access nonce, `@Column({ select: false, nullable: true })`
- **Optional for OTP**: `otpCodeHash`, `otpCodeExpiresAt`, `otpRequestAttempts`, `otpLastSentAt`, `otpLockedUntil`
- **Optional for password reset**: `passwordResetTokenHash`, `passwordResetTokenExpiresAt`

---

## Migration Notes

The demo-api ships these migrations for the User entity:
- `1770265117858-InitUser` — initial user table
- `1770350350572-AddPassword` — password field
- `1770488023470-AddAccessToken` — access token fields
- `1775921200000-AddOtpFields` — OTP fields

---

## Troubleshooting Guide

### TS2742: Inferred type is not portable
Always add `implements IBaseController<CD, UD, RD>` to controllers extending `CreateNestedCrudController(...)`.

### Filtering not working
1. Set `app.getHttpAdapter().getInstance().set('query parser', 'extended')` in `main.ts`
2. Whitelist filterable fields via `allowedFilters` in service options
3. Field names are validated against `/^[A-Za-z][A-Za-z0-9_]*$/`

### Auth token issues
1. User entity must have `accessToken` and `refreshToken` fields (even if nullable)
2. JWT secret must be consistent across all services
3. Token fields should use `select: false` on `@Column()` to prevent leaking
4. Refresh token expects `refreshToken` in request body

### TypeORM Duplicate Key Errors
Use `TypeOrmExceptionFilter` as a global filter. It maps Postgres code 23505 to 422.

### Audit Logs Not Appearing
1. `NestCrudModule` must be imported in the root module
2. `AuditInterceptor` must be registered as a global interceptor
3. Handlers must have `@Audit({ action: '...' })` decorator
4. CRUD controller factory auto-decorates create/update/delete

### findMine returns 404
1. Ensure `enableFindMine: true` is passed to `CreateNestedCrudController`
2. Ensure service configures `userOwnershipField` or `findMineQuery`
3. Ensure `@nest-util/nest-auth` is installed (for `@CurrentUser()` decorator)

### Hooks not firing
1. Ensure hooks are passed as `CrudHookConfig` objects with a `handler` property
2. Check that hook names match exactly: `beforeCreate`, `afterCreate`, etc.

---

## Development Commands (within monorepo)

```bash
pnpm install                    # install deps
npx nx serve demo-api           # run demo
npx nx lint <lib>               # lint
npx nx test <lib>               # test
npx nx build <lib>              # build
npx nx run-many -t build        # build all
npx nx run-many -t typecheck    # typecheck all
npx nx graph                    # dependency graph
npx nx affected -t test         # test affected projects
```

---

## Strict Rules

1. **ALWAYS** add `implements IBaseController<CD, UD, RD>` to controllers extending `CreateNestedCrudController(...)` — prevents TS2742
2. **ALWAYS** use `select: false` on password and token fields in User entity
3. **ALWAYS** set Express query parser to `'extended'` for filter query parameters to parse nested objects
4. **ALWAYS** register `TypeOrmExceptionFilter` as a global filter
5. **NEVER** expose password/token fields in API responses — use `toResponseDto` to strip sensitive fields
6. **ALWAYS** register `ResponseInterceptor` and `AuditInterceptor` as global interceptors via `APP_INTERCEPTOR`
7. **ALWAYS** set `autoLoadEntities: true` on `TypeOrmModule.forRoot()` — required for `AuditLogEntity` registration
8. OTP and Password Reset `deliverCode`/`deliverToken` callbacks MUST be provided when those features are enabled
9. Permission registry `strict` mode (default) throws at startup if a CRUD permission is missing from the registry — set `strict: false` in `buildCrudPermissionsFromRegistry` options to silently skip missing permissions
10. `@Public()` decorator works at both handler and class level (checked via `getAllAndOverride`)
11. `disabledRoutes` in AuthModule accepts route names like `'register'`, `'login'`, `'otp/request'`, `'otp/login'`, `'password-reset/request'`, `'password-reset/reset'`
12. **ALWAYS** ensure `@nest-util/nest-auth` is installed if using `enableFindMine` — the controller factory imports `@CurrentUser()` from it
