---
name: nest-util
description: Use ONLY when working with @nest-util/nest-crud, @nest-util/nest-auth, @nest-util/nest-audit, @nest-util/nest-file, or ncnu packages. Use for NestJS CRUD scaffolding, JWT auth with RBAC, audit logging, encrypted file storage with MinIO, or code generation with ncnu CLI. Covers the entire nest-util monorepo.
---

# Nest-Util Skill

Complete reference for the `nest-util` Nx monorepo: a production-ready collection of NestJS libraries for CRUD operations, JWT authentication with RBAC, audit logging, encrypted file storage, and CLI code generation.

## Project Architecture

Nx monorepo (`pnpm workspaces`) with these packages:

| Package | Version | Purpose |
|---|---|---|
| `@nest-util/nest-crud` | 0.0.3 | Generic CRUD service + controller factory |
| `@nest-util/nest-auth` | 0.0.3 | JWT auth with RBAC, OTP, password reset |
| `@nest-util/nest-audit` | 0.0.3 | Entity-level audit logging interceptor |
| `@nest-util/nest-file` | 0.0.2 | Encrypted file storage with MinIO + Postgres |
| `ncnu` | 0.0.2 | CLI code generator for NestJS CRUD resources |

**Key dependency**: `nest-crud` re-exports `Audit` and `AuditLogEntity` from `nest-audit`. CRUD controller factory uses `@Audit()` automatically on create/update/delete endpoints.

**Integration order**: TypeORM → `NestUtilNestAuditModule` → `AuthModule.forRoot(...)` → `NestCrudService` → `CreateNestedCrudController(...)` → global interceptors/filters.

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
export interface CrudControllerFactoryOptions { permissions?: CrudPermissionsMap }
export const AUTH_PERMISSIONS_METADATA_KEY = 'auth:permissions'

// DTOs
export class FilterDto       // filter?: Record<string, unknown> with @Transform for nested query parsing
export class PaginationDto   // page?, limit?, orderBy?, orderDirection?

// Decorators
export const MESSAGE_KEY = 'customMessage'
export const Message = (message: string) => ...
export const ENTITY_NAME_KEY = 'entityName'
export interface EntityNames { singular: string; plural: string }
export const EntityName = (names: string | EntityNames) => ...

// Interceptor
export class ResponseInterceptor  // wraps { message, data, meta, status: 'success' }

// Interfaces
export type CrudEndpoint = 'findAll' | 'findOne' | 'create' | 'update' | 'remove' | 'findAuditLogs'
export interface AuditLogQuery { user_id?, start_date?, end_date?, page?, limit? }
export interface CrudInterface<CreateDto, UpdateDto, ResponseDto>

// Exception filter
export class TypeOrmExceptionFilter  // catches QueryFailedError: 23505→422, 1062→422

// Re-exports from nest-audit
export { Audit, AuditLogEntity } from '@nest-util/nest-audit'

// Helpers (not exported from index, but available internally)
export function applyFilters(qb, filters, allowedFilters)
export function applyPagination(qb, query)
```

### `NestCrudService` API

```typescript
interface CrudServiceOptions<Entity, ResponseDto> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity)[];      // whitelist filterable fields
  allowedSortFields?: readonly (keyof Entity)[];   // whitelist sortable fields
  include?: readonly string[];                     // joined relations (e.g. ['author', 'author.profile'])
  relations?: {                                     // resolve foreign key IDs → entities
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;                              // defaults to `${property}Id`
  }[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
  disabledEndpoints?: readonly CrudEndpoint[];      // disable specific generated routes
}
```

**Methods**:
- `findAll(query: PaginationDto & FilterDto)` → `{ data: ResponseDto[], meta?: { page, limit, total } }`
- `findOne(id: number)` → `ResponseDto`
- `create(payload: CreateDto)` → `ResponseDto`
- `update(id: number, payload: UpdateDto)` → `ResponseDto`
- `remove(id: number)` → `boolean`
- `findAuditLogs(query: AuditLogQuery)` → `{ data: AuditLogEntity[], meta: { total, page, limit, totalPages } }`

**`relations` option behavior**: When `relations` is configured, `create` and `update` will:
1. Look for a payload field named `${property}Id` (or custom `idField`)
2. Fetch the related entity from the given repository
3. Assign it to `payload[property]`
4. Delete the `${property}Id` field from the payload

### `CreateNestedCrudController` Generated Endpoints

| Endpoint | Method | Decorators | Permission Key |
|---|---|---|---|
| `GET /` (findAll) | `@Get()` | `@Message('fetched')`, `@ApiQuery` for filters/pagination | `findAll` |
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

**Safety**: Field names validated against `/^[A-Za-z][A-Za-z0-9_]*$/`. Only `allowedFilters` fields are processed.

### Pagination

`PaginationDto` fields: `page` (default 1, min 1), `limit` (default 10, min 1), `orderBy`, `orderDirection` ('ASC' | 'DESC', default 'DESC').

`applyPagination()` only applies `skip()`/`take()` when both `page` and `limit` are provided. If absent, no pagination is applied (returns all results).

Sorting via `orderBy` only works if field is in `allowedSortFields` (or if `allowedSortFields` is empty, any field is allowed).

### Response Wrapping

`ResponseInterceptor` transforms all responses into:
```json
{
  "message": "{EntityPlural} {action} successfully",  // from @Message() + @EntityName()
  "data": ...,         // response.data or response itself
  "meta": { ... },     // pagination meta if present
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
- `findAll` → `read`, `findOne` → `read`, `create` → `create`, `update` → `update`, `remove` → `delete`, `findAuditLogs` → `audit`

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
- All sensitive fields (password, tokens, OTP fields) are stripped from response via `removeSensitiveData()`

---

## Package 3: `@nest-util/nest-audit`

### Exports

```typescript
export class NestUtilNestAuditModule {}    // TypeOrmModule.forFeature([AuditLogEntity])
export class AuditLogEntity                // table: audit_logs
export const AUDIT_METADATA_KEY = 'nest_util_audit'
export interface AuditOptions { action: string; entity?: string }
export const Audit = (options: AuditOptions) => ...
export class AuditInterceptor              // intercepts @Audit() decorated handlers
export interface CreateAuditLogInput       // action, tenantId?, entity?, entityId?, userId?, metadata?, ip?, userAgent?
export class ListAuditLogsDto              // user_id?, start_date?, end_date?, page?, limit?
export class AuditService {
  log(input: CreateAuditLogInput): Promise<AuditLogEntity>
  logEntityAction(action, entity, entityId?, options?): Promise<AuditLogEntity>
  findAll(options?: FindAuditLogsOptions): Promise<{ data, meta: { total, page, limit, totalPages } }>
}
```

### `AuditLogEntity` Structure

```typescript
@Entity('audit_logs')
class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true }) tenantId?: string;
  @Column() action: string;
  @Column({ nullable: true }) entity?: string;
  @Column({ nullable: true }) entityId?: string;
  @Column({ nullable: true }) userId?: string;
  @Column({ type: 'jsonb', nullable: true }) metadata?: Record<string, unknown>;
  @Column({ nullable: true }) ip?: string;
  @Column({ nullable: true }) userAgent?: string;
  @CreateDateColumn() createdAt: Date;
}
```

### How `AuditInterceptor` Works

1. On every request, checks handler for `@Audit()` metadata via `Reflector`
2. If no `@Audit()` → passes through without logging
3. If `@Audit()` present → captures `request.user.id`, `request.ip`, `request.headers['user-agent']`
4. Resolves entity name: uses `auditOptions.entity` if provided; otherwise:
   a. Checks controller class for `entityName` metadata (from `@EntityName()`)
   b. Falls back to `Reflect.getMetadata('custom:entityName', repositoryTarget)` from the service's repository target
   c. Final fallback: `'Resource'`
5. On response (via `tap`), logs: `action`, resolved `entity`, `userId`, `ip`, `userAgent`, and `metadata` containing `{ body, params, query, response }`

### Integration with nest-crud

CRUD controller factory decorates `create`, `update`, `remove` with:
```typescript
@Audit({ action: 'CREATE' })  // on create
@Audit({ action: 'UPDATE' })  // on update
@Audit({ action: 'DELETE' })  // on remove
```

`NestCrudService.findAuditLogs()` queries `AuditLogEntity` filtered by `entity = repository.metadata.name` (the TypeORM entity table name), with optional filters for `user_id`, date range, and pagination.

---

## Package 4: `@nest-util/nest-file`

### Exports

```typescript
export class NestFileModule { static forRoot(options): DynamicModule; static forRootAsync(options): DynamicModule }
export class StoredFileEntity
export interface FileModuleOptions { minio, bucket, encryption }
export interface FileModuleAsyncOptions { imports?, useExisting?, useClass?, useFactory?, inject? }
export interface FileModuleOptionsFactory { createFileModuleOptions(): ... }
export interface FileEncryptionOptions { algorithm?: 'aes-256-gcm'; key: string }
export interface MinioOptions { endPoint, port?, useSSL?, accessKey, secretKey }
export interface MinioBucketOptions { bucket, region?, makeBucketIfMissing? }
export interface FileOwner { ownerType: string; ownerId: string }
export interface StoreFileInput { fileName, contentType, buffer: Buffer, ownerType, ownerId, metadata? }
export interface GetFileResult { fileName, contentType, buffer, ownerType, ownerId, metadata }
export class FileEncryptionService {
  encrypt(buffer: Buffer): EncryptionPayload
  decrypt(encrypted: Buffer, iv: string, authTag: string): Buffer
  getDigest(buffer: Buffer): string
}
export interface EncryptionPayload { encrypted, iv, authTag, digest, algorithm, keyId }
export class StoredFileService implements OnModuleInit {
  store(input: StoreFileInput): Promise<StoredFileEntity>
  getById(fileId: string): Promise<GetFileResult>
  listByOwner(ownerType: string, ownerId: string): Promise<StoredFileEntity[]>
  remove(fileId: string): Promise<void>
}
export const FILE_MODULE_OPTIONS = Symbol('FILE_MODULE_OPTIONS')
export const FileOwnerEntity = (ownerType: string) => ...
export const FILE_OWNER_KEY = 'file_owner_type'
export class UploadFileDto { fileName, contentType, ownerType, ownerId, metadata? }
```

### Configuration

```typescript
NestFileModule.forRoot({
  minio: {
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  },
  bucket: {
    bucket: 'uploads',
    region: 'us-east-1',
    makeBucketIfMissing: true,   // default: true
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    key: '<base64-encoded 32-byte key>',  // MUST be base64-encoded 32-byte Buffer
  },
})
```

### File Encryption

- AES-256-GCM encryption using Node.js `crypto.createCipheriv()`
- 12-byte random IV per encryption
- Auth tag for GCM authentication
- SHA-256 digest of original plaintext for integrity verification on retrieval
- Key ID = first 16 hex chars of SHA-256(key)
- On `getById()`: decrypts → verifies SHA-256 digest → if mismatch, throws `Error('Integrity check failed')`

### MinIO Integration

- Uses dynamic `require('minio')` (not static import)
- `onModuleInit()`: checks if bucket exists, creates if missing (when `makeBucketIfMissing` is true)
- Object key format: `{ownerType}/{ownerId}/{randomUUID()}`
- `remove()`: deletes object from MinIO + DB record

### `StoredFileEntity` Structure

```typescript
@Entity('stored_files')
class StoredFileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() fileName: string;
  @Column() contentType: string;
  @Column() objectKey: string;       // MinIO object key
  @Column({ type: 'bigint' }) size: number;
  @Column() encryptionAlgorithm: string;
  @Column() encryptionKeyId: string;
  @Column() iv: string;             // base64
  @Column() authTag: string;        // base64
  @Column() digest: string;         // SHA-256 base64
  @Column() ownerType: string;
  @Column() ownerId: string;
  @Column({ type: 'jsonb', nullable: true }) metadata?: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

---

## Package 5: `ncnu` CLI Code Generator

### Usage

```bash
ncnu --gen <ModelName> --path <targetPath> <field:type> [field:type ...]
```

Example:
```bash
ncnu --gen Post --path apps/my-api/src/app \
  title:string \
  content:string \
  published:boolean \
  publishedAt:date \
  authorId:number
```

### Supported Field Types

| Type | TypeORM Column | TS Type | Notes |
|---|---|---|---|
| `string` | `varchar` | `string` | |
| `number` | `int` | `number` | |
| `boolean` | — (not mapped) | `boolean` | |
| `date` | `timestamp` | `Date` | |
| `hash` | `varchar` (nullable) | `string` | For password/OTP fields |
| `relation:Target` | `ManyToOne` + `JoinColumn` | `Target` | Generates `{name}Id: number` in DTOs |
| `relationMany:Target` | `ManyToMany` + `JoinTable` | `Target[]` | Generates `{name}Ids: number[]` in DTOs |

### Generated Files

For model `Post` at path `apps/my-api/src/app`:

```
apps/my-api/src/app/post/
├── post.entity.ts              # TypeORM entity with @PrimaryGeneratedColumn, @CreateDateColumn, @UpdateDateColumn
├── dtos/
│   ├── create-post.dto.ts      # All fields required with @ApiProperty
│   └── update-post.dto.ts      # All fields optional (?) with @ApiProperty
├── post.service.ts             # Extends NestCrudService<Post, CreatePostDto, UpdatePostDto>
└── post.controller.ts          # Extends CreateNestedCrudController(CreateDto, UpdateDto, Entity)
                                  # Includes @EntityName, @UseGuards(JwtAuthGuard), @ApiBearerAuth
```

Generated controller includes:
- `@EntityName({ singular: 'Post', plural: 'Posts' })`
- `@UseGuards(JwtAuthGuard)` (auth-protected by default)
- `@ApiBearerAuth()` + `@ApiExtraModels()` for Swagger
- Implements `IBaseController<CreateDto, UpdateDto, Entity>` (avoids TS2742)

### Export

```typescript
export async function generate(modelName: string, fields: string[], targetPath: string): Promise<void>
```

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
    NestUtilNestAuditModule,
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
    NestFileModule.forRoot({ minio: {...}, bucket: {...}, encryption: { key: '...' } }),
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
// PostController with permission guard
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
  disabledEndpoints: ['remove', 'findAuditLogs'],  // disable DELETE and audit logs
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
1. `NestUtilNestAuditModule` must be imported in the root module
2. `AuditInterceptor` must be registered as a global interceptor
3. Handlers must have `@Audit({ action: '...' })` decorator
4. CRUD controller factory auto-decorates create/update/delete

### File Encryption Key
Must be a base64-encoded 32-byte key. Example generation:
```typescript
const key = require('crypto').randomBytes(32).toString('base64');
```

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

1. **NEVER** import from `@nest-util/nest-audit` directly when using `nest-crud` — re-exported via `nest-crud` index
2. **ALWAYS** add `implements IBaseController<CD, UD, RD>` to controllers extending `CreateNestedCrudController(...)` — prevents TS2742
3. **ALWAYS** use `select: false` on password and token fields in User entity
4. **ALWAYS** set Express query parser to `'extended'` for filter query parameters to parse nested objects
5. **ALWAYS** register `TypeOrmExceptionFilter` as a global filter
6. **NEVER** expose password/token fields in API responses — use `toResponseDto` to strip sensitive fields
7. **ALWAYS** register `ResponseInterceptor` and `AuditInterceptor` as global interceptors via `APP_INTERCEPTOR`
8. **ALWAYS** import `NestUtilNestAuditModule` before `AuthModule` (audit logs are needed by CRUD controller factory)
9. OTP and Password Reset `deliverCode`/`deliverToken` callbacks MUST be provided when those features are enabled
10. File encryption key MUST be exactly 32 bytes base64-encoded
11. The `ncnu` generator creates auth-protected controllers by default (`@UseGuards(JwtAuthGuard)`)
12. Permission registry `strict` mode (default) throws at startup if a CRUD permission is missing from the registry — set `strict: false` in `buildCrudPermissionsFromRegistry` options to silently skip missing permissions
13. `@Public()` decorator works at both handler and class level (checked via `getAllAndOverride`)
14. `disabledRoutes` in AuthModule accepts route names like `'register'`, `'login'`, `'otp/request'`, `'otp/login'`, `'password-reset/request'`, `'password-reset/reset'`
