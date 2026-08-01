---
name: nest-util
description: Complete guide for using @nest-util/nest-crud, @nest-util/nest-auth, @nest-util/nest-file, and @nest-util/nest-payment in any NestJS project. Covers CRUD scaffolding, JWT auth with RBAC and API keys, audit logging, lifecycle hooks, cursor pagination, findMine, S3 file uploads, payments with webhooks and reconciliation, and a testing factory. Use when working with these packages.
---

# Nest-Util Consumer Guide

Complete reference for consuming `@nest-util/nest-crud` v1.0.8, `@nest-util/nest-auth` v1.1.1, `@nest-util/nest-file` v1.0.1, and `@nest-util/nest-payment` v1.0.1 in any NestJS project.

## Overview

Four packages that eliminate NestJS boilerplate:

| Package | Version | Purpose |
|---|---|---|
| `@nest-util/nest-crud` | 1.0.8 | CRUD scaffolding, audit logging, lifecycle hooks, cursor pagination, findMine, testing factory |
| `@nest-util/nest-auth` | 1.1.1 | JWT auth with RBAC, API key auth, OTP login, password reset |
| `@nest-util/nest-file` | 1.0.1 | S3/MinIO file uploads with presigned URLs and metadata tracking |
| `@nest-util/nest-payment` | 1.0.1 | Provider-agnostic payments: checkout, subscriptions, refunds, webhooks, reconciliation |

**Key design**: Audit logging, hooks, cursor pagination, findMine, and testing are all built into `nest-crud`. `nest-file` and `nest-payment` both depend on `nest-auth` for guards and the `@CurrentUser()` decorator.

**Integration order**: TypeORM → `AuthModule.forRoot(...)` → `NestCrudService` → `CreateNestedCrudController(...)` → (optional) `NestFileModule.forRoot(...)` / `NestPaymentModule.forRoot(...)` → global interceptors/filters.

---

## Installation

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-crud@^1.0.8 @nest-util/nest-auth@^1.1.1 @nest-util/nest-file@^1.0.1 @nest-util/nest-payment@^1.0.1 typeorm@^1.1.0 @nestjs/typeorm @nestjs/swagger @nestjs/jwt @nestjs/passport class-validator class-transformer bcrypt
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner  # only if using nest-file
pnpm add -D @types/passport-jwt @types/bcrypt
```

Install only the packages you need. `nest-file` requires the AWS SDK (works with any S3-compatible endpoint such as MinIO). `nest-file` and `nest-payment` both require `@nest-util/nest-auth` to be installed for guards and the `@CurrentUser()` decorator.

### Peer Dependencies

These packages expect the following to be installed in your project:

| Package | Version | Notes |
|---|---|---|
| `@nestjs/common` | ^11.0.0 | NestJS core |
| `@nestjs/core` | ^11.0.0 | NestJS core |
| `@nestjs/typeorm` | ^11.0.2 | TypeORM integration |
| `@nestjs/swagger` | ^11.2.6 | Swagger decorators |
| `@nestjs/jwt` | ^11.0.2 | JWT module (auth) |
| `@nestjs/passport` | ^11.0.5 | Passport integration (auth) |
| `typeorm` | ^1.1.0 | TypeORM v1.1.0+ required |
| `class-validator` | ^0.14.3 | DTO validation |
| `class-transformer` | ^0.5.1 | DTO transformation |
| `bcrypt` | ^6.0.0 | Password hashing (auth) |
| `passport-jwt` | ^4.0.1 | JWT strategy (auth) |
| `@aws-sdk/client-s3` | ^3.700.0 | S3 client (file) |
| `@aws-sdk/s3-request-presigner` | ^3.700.0 | Presigned URL generation (file) |

---

## User Entity

Your User entity must have these fields for `AuthModule` to work. Field names are configurable via `AuthModule.forRoot()` options.

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  // REQUIRED: bcrypt-hashed password — select: false prevents leaking in queries
  @Column({ select: false })
  password!: string;

  // REQUIRED: stores bcrypt hash of refresh nonce — rotated on every refresh
  @Column({ select: false, nullable: true })
  refreshToken?: string;

  // REQUIRED: stores bcrypt hash of access nonce — rotated on every refresh
  @Column({ select: false, nullable: true })
  accessToken?: string;

  // OPTIONAL: OTP fields (only if otp.enabled: true)
  @Column({ select: false, nullable: true })
  otpCodeHash?: string;

  @Column({ type: 'timestamptz', nullable: true })
  otpCodeExpiresAt?: Date;

  @Column({ default: 0 })
  otpRequestAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  otpLastSentAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  otpLockedUntil?: Date;

  // OPTIONAL: Password reset fields (only if passwordReset.enabled: true)
  @Column({ select: false, nullable: true })
  passwordResetTokenHash?: string;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetTokenExpiresAt?: Date;

  // RBAC: relation to user-role join table
  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles?: UserRole[];
}
```

### Guardrail: Password Fields

**NEVER** remove `select: false` from `password`, `refreshToken`, and `accessToken` columns. Without it, every `findOne()` call will return these fields in the response, leaking sensitive data. The auth module uses `addSelect()` internally to fetch them only when needed.

---

## AuthModule Setup

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nest-util/nest-auth';
import { NestCrudModule } from '@nest-util/nest-crud';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,    // REQUIRED for AuditLogEntity registration
      synchronize: true,         // SET FALSE IN PRODUCTION — use migrations
    }),
    TypeOrmModule.forFeature([User]),
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: process.env.JWT_SECRET,
      refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      refreshTokenField: 'refreshToken',
      accessTokenField: 'accessToken',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      relations: ['userRoles', 'userRoles.role'],
      rbac: {
        userRolesRelation: 'userRoles',
        rolesKey: 'userRoles',
        nestedRoleKey: 'role',
      },
      permissionRegistry,
      disabledRoutes: [],
      otp: {
        enabled: true,
        deliverCode: async ({ identifier, code, expiresAt }) => {
          // TODO: Send OTP code via email/SMS
          console.log(`OTP ${code} for ${identifier}, expires ${expiresAt}`);
        },
      },
      passwordReset: {
        enabled: true,
        deliverToken: async ({ identifier, token, expiresAt }) => {
          // TODO: Send reset link via email
          console.log(`Reset token for ${identifier}: ${token}`);
        },
      },
    }),
    NestCrudModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
```

### AuthModule Options Reference

| Option | Type | Default | Required | Description |
|---|---|---|---|---|
| `userEntity` | `Type<unknown>` | — | Yes | Your User entity class |
| `identifierField` | `string` | — | Yes | Login field name (e.g. `'email'`) |
| `passkeyField` | `string` | — | Yes | Password field name (e.g. `'password'`) |
| `jwtSecret` | `string` | — | Yes | JWT signing secret |
| `expiresIn` | `string` | `'1h'` | No | Access token expiry |
| `refreshTokenSecret` | `string` | same as jwtSecret | No | Refresh token signing secret |
| `refreshTokenExpiresIn` | `string` | `'7d'` | No | Refresh token expiry |
| `refreshTokenField` | `string` | `'refreshToken'` | No | DB field for hashed refresh nonce |
| `accessTokenField` | `string` | `'accessToken'` | No | DB field for hashed access nonce |
| `refreshTokenHeaderName` | `string` | `'x-refresh-token'` | No | Header name for refresh token |
| `disabledRoutes` | `string[]` | `[]` | No | Routes to disable (e.g. `['register']`, `['verify']`) |
| `loginDto` | `Type<unknown>` | — | No | Custom login DTO class |
| `registerDto` | `Type<unknown>` | — | No | Custom register DTO class |
| `refreshDto` | `Type<unknown>` | — | No | Custom refresh DTO class |
| `relations` | `string[]` | — | No | Relations to load during JWT validation |
| `rbac` | `AuthRbacOptions` | — | No | RBAC configuration |
| `permissionRegistry` | `PermissionRegistryConfig` | — | No | Permission registry for CRUD |
| `otp` | `AuthOtpOptions` | — | No | OTP login configuration |
| `passwordReset` | `AuthPasswordResetOptions` | — | No | Password reset configuration |
| `apiKey` | `ApiKeyModuleOptions` | — | No | API key authentication configuration |
| `verification` | `AuthVerificationOptions` | — | No | Registration OTP verification |

### OTP Configuration

```typescript
otp: {
  enabled: true,
  codeLength: 6,           // 4-10, default: 6
  ttlSeconds: 300,         // Code validity, default: 300 (5 min)
  cooldownSeconds: 60,     // Min time between requests, default: 60
  maxAttempts: 5,          // Max failed attempts before lock, default: 5
  lockSeconds: 300,        // Lockout duration, default: 300
  channel: 'email',        // Delivery channel, default: 'email'
  deliverCode: async ({ identifier, code, expiresAt }) => {
    // REQUIRED callback — send the code to the user
  },
}
```

### Password Reset Configuration

```typescript
passwordReset: {
  enabled: true,
  tokenLength: 64,         // Token length, default: 64
  tokenTtlSeconds: 3600,   // Token validity, default: 3600 (1 hour)
  deliverToken: async ({ identifier, token, expiresAt }) => {
    // REQUIRED callback — send the reset link to the user
  },
}
```

### Guardrail: OTP/Password Reset Callbacks

**MUST** provide `deliverCode` when `otp.enabled: true` and `deliverToken` when `passwordReset.enabled: true`. The module throws at startup if these are missing.

### Account Verification Configuration

When enabled, `POST /auth/register` creates the user with `isVerified: false` and automatically sends an OTP code. The user must call `POST /auth/verify` with the code to activate their account. Login, refresh, and JWT validation are blocked until verified.

```typescript
verification: {
  enabled: true,
  codeLength: 6,            // 4-10, default: 6
  ttlSeconds: 600,          // Code validity, default: 600 (10 min)
  cooldownSeconds: 60,      // Min time between resends, default: 60
  maxAttempts: 5,           // Max failed attempts before user is deleted, default: 5
  lockSeconds: 300,         // Lockout duration, default: 300
  channel: 'email',         // Delivery channel, default: 'email'
  deliverCode: async ({ identifier, code, expiresAt }) => {
    // REQUIRED callback — send the code to the user
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | — | Enable registration verification |
| `codeLength` | `number` | `6` | OTP code length (4-10) |
| `ttlSeconds` | `number` | `600` | Code validity in seconds |
| `cooldownSeconds` | `number` | `60` | Min time between resends |
| `maxAttempts` | `number` | `5` | Max failed attempts (user deleted on exceed) |
| `lockSeconds` | `number` | `300` | Lockout after too many attempts |
| `channel` | `string` | `'email'` | Delivery channel passed to callback |
| `verifiedField` | `string` | `'isVerified'` | Boolean column on user entity |
| `verifiedAtField` | `string` | `'verifiedAt'` | Timestamp column on user entity |
| `codeHashField` | `string` | `'verificationCodeHash'` | Stores bcrypt-hashed OTP |
| `expiresAtField` | `string` | `'verificationCodeExpiresAt'` | OTP expiry timestamp |
| `attemptsField` | `string` | `'verificationAttempts'` | Failed attempt counter |
| `lastSentAtField` | `string` | `'verificationLastSentAt'` | Cooldown timestamp |
| `lockUntilField` | `string` | `'verificationLockedUntil'` | Lockout timestamp |
| `inputCodeField` | `string` | `'code'` | Field name in verify request body |
| `requestDto` | `Type<unknown>` | — | Swagger DTO for resend endpoint |
| `verifyDto` | `Type<unknown>` | — | Swagger DTO for verify endpoint |
| `deliverCode` | `OtpDeliveryCallback` | — | **Required** — callback to send the code |

**Required user entity columns** (with default names):

```typescript
@Column({ default: false })
isVerified!: boolean;

@Column({ type: 'timestamptz', nullable: true })
verifiedAt?: Date;

@Column({ select: false, nullable: true })
verificationCodeHash?: string;

@Column({ type: 'timestamptz', nullable: true, select: false })
verificationCodeExpiresAt?: Date;

@Column({ default: 0, select: false })
verificationAttempts!: number;

@Column({ type: 'timestamptz', nullable: true, select: false })
verificationLastSentAt?: Date;

@Column({ type: 'timestamptz', nullable: true, select: false })
verificationLockedUntil?: Date;
```

**Endpoints**:

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `POST /auth/register` | POST | No | Creates unverified user + sends OTP (no tokens) |
| `POST /auth/verify` | POST | No | Validates code → marks verified + issues tokens |
| `POST /auth/verify/resend` | POST | No | Sends a fresh verification code |

**Flow**: On wrong code, attempts are tracked. After max attempts or code expiry, the user is deleted (must register again). `POST /auth/login`, `POST /auth/refresh`, and JWT validation all reject unverified users with 401.

**Guardrail**: `deliverCode` **MUST** be provided when `verification.enabled: true`. The module throws at startup if it's missing.

---

## API Key Authentication

Enable API key auth for machine-to-machine access. Keys are bcrypt-hashed, scoped to a user, and can inherit RBAC permissions via roles.

### Configuration

```typescript
AuthModule.forRoot({
  // ...
  apiKey: {
    enabled: true,
    headerName: 'x-api-key',   // default: 'x-api-key'
    keyPrefix: 'nuk_live_',    // default: 'nuk_live_'
    hashRounds: 10,            // default: 10
  },
});
```

When `enabled`, the module registers `ApiKeyService`, `ApiKeyGuard`, and the `ApiKeyEntity`/`ApiKeyRoleEntity` tables. You must add these entities to your `autoLoadEntities`/migrations.

### `ApiKeyGuard` Behavior

- If the `x-api-key` header is **absent**, the guard passes through (JWT auth still applies — the key is an alternative, not a replacement).
- If a valid key is present, it sets `request.user` (an `AuthUser` with permissions resolved from the key's roles) and `request.apiKey`.
- Invalid, revoked, or expired keys throw `UnauthorizedException`.

Use it together with `JwtAuthGuard` and `PermissionsGuard` on your routes:

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard, ApiKeyGuard)
@Get('reports')
@Permissions('reports.read')
async getReports(@CurrentUser() user: AuthUser) { ... }
```

### Admin API Key Routes

All routes require `JwtAuthGuard` + `PermissionsGuard` with `admin.access`:

| Endpoint | Method | Description |
|---|---|---|
| `POST /auth/api-keys` | POST | Create a key (`{ name, roleIds?, expiresAt? }`) — raw key returned once |
| `GET /auth/api-keys` | GET | List current user's keys with roles |
| `DELETE /auth/api-keys/:id` | DELETE | Revoke a key |
| `POST /auth/api-keys/:id/roles/:roleId` | POST | Assign a role to a key |
| `DELETE /auth/api-keys/:id/roles/:roleId` | DELETE | Remove a role from a key |

### `ApiKeyService` Methods

| Method | Description |
|---|---|
| `create(userId, { name, roleIds?, expiresAt? })` | Generate a key (`nuk_live_` + base64url). Hash stored; raw key returned once |
| `list(userId)` | List keys with assigned roles |
| `revoke(userId, keyId)` | Deactivate a key |
| `validate(rawKey)` | Resolve key → `{ user, apiKey }` with RBAC permissions |
| `assignRole(userId, keyId, roleId)` / `removeRole(...)` | Manage key roles |

### Events

When `@nestjs/event-emitter` is installed, auth emits: `auth.api-key.used`, `auth.api-key.denied`, and `auth.permissions.denied` (each with `{ action, entity, timestamp, ...data }`).

---

## NestCrudService Setup

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title', 'authorId'],
      allowedSortFields: ['createdAt', 'title'],
      include: ['author'],
      userOwnershipField: 'authorId',
      hooks: {
        afterCreate: {
          handler: async (ctx) => {
            // Send notification, emit event
          },
        },
      },
    });
  }
}
```

### Service Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `repository` | `Repository<Entity>` | — | TypeORM repository (required) |
| `allowedFilters` | `readonly (keyof Entity)[]` | `[]` | Whitelist of filterable fields |
| `allowedSortFields` | `readonly (keyof Entity)[]` | `[]` | Whitelist of sortable fields (empty = all) |
| `include` | `readonly string[]` | `[]` | Relations to join (e.g. `['author']`). Supports nested dot-notation: `['userRoles.role']` is converted to `{ userRoles: { role: true } }` for TypeORM. |
| `relations` | `RelationConfig[]` | `[]` | Resolve foreign key IDs → entities |
| `toResponseDto` | `(entity) => ResponseDto` | — | Transform entity to response DTO |
| `createDtoClass` | `Type<unknown>` | — | Create DTO class for validation |
| `updateDtoClass` | `Type<unknown>` | — | Update DTO class for validation |
| `disabledEndpoints` | `readonly CrudEndpoint[]` | `[]` | Endpoints to disable |
| `cursorStrategy` | `CursorStrategy` | auto | Override cursor strategy detection |
| `hooks` | `CrudHooks<Entity>` | — | Lifecycle hooks configuration |
| `transactionConfig` | `TransactionConfig` | — | Transaction isolation level |
| `userOwnershipField` | `keyof Entity` | — | Enable findMine with column match |
| `findMineQuery` | `(qb, userId) => void` | — | Enable findMine with custom query |
| `enforceOwnership` | `boolean` | `false` | Enable ownership checks on `findOne`/`update`/`remove` |
| `ownershipBypassPermissions` | `readonly string[]` | `[]` | Permissions that bypass ownership checks |
| `ownershipBypass` | `(user: OwnershipUser) => boolean` | — | Custom predicate for bypassing ownership |

### Service Methods

| Method | Signature | Returns |
|---|---|---|
| `findAll` | `(query: PaginationDto & FilterDto)` | `{ data: ResponseDto[], meta?: { page, limit, total } }` |
| `findAllWithCursor` | `(query: CursorPaginationDto & FilterDto)` | `CursorPaginationResult<ResponseDto>` |
| `findOne` | `(id: number, user?: OwnershipUser)` | `ResponseDto` |
| `create` | `(payload: CreateDto, user?: OwnershipUser)` | `ResponseDto` |
| `update` | `(id: number, payload: UpdateDto, user?: OwnershipUser)` | `ResponseDto` |
| `remove` | `(id: number, user?: OwnershipUser)` | `boolean` |
| `findMine` | `(userId, query)` | `{ data: ResponseDto[], meta?: ... }` |
| `findAuditLogs` | `(query: AuditLogQuery)` | `{ data: AuditLogEntity[], meta: { total, page, limit, totalPages } }` |

### Relations Option — Foreign Key Resolution

When `relations` is configured, `create` and `update` automatically:
1. Look for a payload field named `${property}Id` (or custom `idField`)
2. Fetch the related entity from the given repository
3. Assign it to `payload[property]`
4. Delete the `${property}Id` field from the payload

```typescript
super({
  repository: postRepo,
  relations: [
    { property: 'author', repo: userRepo, idField: 'authorId' },
    { property: 'category', repo: categoryRepo },  // idField defaults to 'categoryId'
  ],
});
// Now creating with { title: '...', authorId: 5 } will:
// 1. Fetch User with id=5
// 2. Set post.author = fetchedUser
// 3. Remove authorId from payload before save
```

---

## Controller Factory

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  PermissionsGuard,
  buildCrudPermissionsFromRegistry,
} from '@nest-util/nest-auth';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { permissionRegistry } from '../auth/permission-registry';

const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, {
      resource: 'posts',
    }),
    enableFindMine: true,
  }
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

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

### Controller Options

| Option | Type | Description |
|---|---|---|
| `permissions` | `CrudPermissionsMap` | Permission map for endpoints (auto-applied via `@Permissions()`) |
| `enableFindMine` | `boolean` | Enable `GET /mine` endpoint |

### Guardrail: `implements IBaseController`

**ALWAYS** add `implements IBaseController<CreateDto, UpdateDto, Entity>` to your controller class OR cast the factory output to `abstract new (service: Service) => IBaseController<...>`. Without this, TypeScript throws `TS2742: Inferred type is not portable`.

---

## Generated Endpoints

### CRUD Endpoints

| Endpoint | Method | Description | Auth | Auto-Audited |
|---|---|---|---|---|
| `GET /resource` | GET | List with filtering, pagination, cursor support | Optional | No |
| `GET /resource/mine` | GET | User-scoped records (requires `enableFindMine`) | Required | No |
| `GET /resource/:id` | GET | Get single record | Optional | No |
| `POST /resource` | POST | Create record | Optional | Yes |
| `PATCH /resource/:id` | PATCH | Update record | Optional | Yes |
| `DELETE /resource/:id` | DELETE | Delete record | Optional | Yes |
| `GET /resource/auditlogs` | GET | Query audit trail | Optional | No |

### Auth Endpoints

The auth module auto-registers **five Swagger-tagged controllers**: Authentication, Permissions, Roles, User Roles, and API Keys.

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `POST /auth/register` | POST | No | Register new user (unverified if `verification.enabled`) |
| `POST /auth/login` | POST | No | Login with credentials |
| `POST /auth/refresh` | POST | No | Refresh access token |
| `POST /auth/logout` | POST | JwtAuthGuard | Invalidate tokens |
| `GET /auth/me` | GET | JwtAuthGuard | Current user profile |
| `GET /auth/me/permissions` | GET | JwtAuthGuard | Get effective permissions |
| `POST /auth/update-password` | POST | JwtAuthGuard | Change own password |
| `POST /auth/password-reset/request` | POST | No | Request reset token |
| `POST /auth/password-reset/reset` | POST | No | Reset password with token |
| `POST /auth/otp/request` | POST | No | Request OTP code |
| `POST /auth/otp/login` | POST | No | Login with OTP |
| `POST /auth/verify` | POST | No | Verify account with OTP code |
| `POST /auth/verify/resend` | POST | No | Resend verification OTP code |
| `POST /auth/roles` | POST | admin.access | Create role |
| `GET /auth/roles` | GET | admin.access | List all roles |
| `POST /auth/users/:userId/roles/:roleId` | POST | admin.access | Assign role |
| `DELETE /auth/users/:userId/roles/:roleId` | DELETE | admin.access | Remove role |
| `POST /auth/roles/:roleId/permissions` | POST | admin.access | Add permissions |
| `DELETE /auth/roles/:roleId/permissions` | DELETE | admin.access | Remove permissions |
| `GET /auth/users/:userId/roles` | GET | admin.access | Get user's roles |
| `POST /auth/api-keys` | POST | admin.access | Create API key |
| `GET /auth/api-keys` | GET | admin.access | List API keys |
| `DELETE /auth/api-keys/:id` | DELETE | admin.access | Revoke API key |
| `POST /auth/api-keys/:id/roles/:roleId` | POST | admin.access | Assign role to API key |
| `DELETE /auth/api-keys/:id/roles/:roleId` | DELETE | admin.access | Remove role from API key |

---

## Lifecycle Hooks

Configure hooks in `CrudServiceOptions` for before/after interception:

```typescript
super({
  repository,
  hooks: {
    beforeCreate: {
      handler: async (ctx) => {
        // ctx.payload — the create DTO
        ctx.payload.title = ctx.payload.title.trim();
      },
      transaction: true,  // runs inside a DB transaction
    },
    afterCreate: {
      handler: async (ctx) => {
        // ctx.entity — the saved entity
        // ctx.payload — the original DTO
        await this.notificationService.notify('post.created', ctx.entity);
      },
    },
    beforeRemove: {
      handler: async (ctx) => {
        // ctx.entity — the entity being deleted
        // ctx.id — the entity ID
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
```

### Available Hooks

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

### Transaction Config

```typescript
interface TransactionConfig {
  isolationLevel?:
    | 'READ UNCOMMITTED'
    | 'READ COMMITTED'
    | 'REPEATABLE READ'
    | 'SERIALIZABLE';
  timeout?: number;  // milliseconds
}
```

When `transaction: true` on a hook, the handler runs inside a `QueryRunner` transaction. If the hook throws, the entire transaction rolls back — including the CRUD operation itself.

---

## Cursor Pagination

Pass `?cursor=<opaque>` to any `GET /` endpoint to switch from offset to cursor pagination automatically.

### Integer Primary Keys

```bash
# First page
GET /posts?limit=10

# Next page (cursor is the ID of the last item)
GET /posts?cursor=eyJpZCI6MTB9&limit=10

# With total count
GET /posts?cursor=eyJpZCI6MTB9&limit=10&includeTotal=true
```

Integer PKs use simple `id > cursor` — fast and efficient.

### UUID Primary Keys

For entities with UUID primary keys (like `AuditLogEntity`), the system uses composite `(createdAt, id)` cursors. This is auto-detected from repository metadata.

### Response Shape

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

`total` is only present when `?includeTotal=true` is passed (disabled by default for performance).

### Cursor Encoding

Cursors are base64url-encoded JSON — opaque to clients. Never parse or construct cursors manually. The system handles encoding/decoding internally.

---

## findMine (User-Scoped Records)

### Simple Column Match

When all user-owned records have a direct foreign key:

```typescript
// Service
super({
  repository,
  userOwnershipField: 'authorId',  // WHERE e.authorId = :userId
});

// Controller
const PostControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post,
  { enableFindMine: true }
);
```

### Custom Query

For complex ownership (e.g., author OR collaborator):

```typescript
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
```

**Endpoint**: `GET /resource/mine` — requires authentication, returns user-scoped records with standard pagination.

### Guardrail: findMine Requirements

`findMine` returns 404 unless ALL of these are true:
1. `enableFindMine: true` is passed to `CreateNestedCrudController`
2. Service configures `userOwnershipField` or `findMineQuery`
3. `@nest-util/nest-auth` is installed (for `@CurrentUser()` decorator)

### Ownership Enforcement on findOne/update/remove

When `enforceOwnership: true` is set alongside `userOwnershipField` or `findMineQuery`, the generic `findOne`, `update`, and `remove` operations are scoped to records owned by the authenticated user. Non-owned records return 404, and unauthenticated requests return 403.

```typescript
super({
  repository,
  userOwnershipField: 'authorId',
  enforceOwnership: true,                          // opt-in — defaults to false
  ownershipBypassPermissions: ['admin.access'],    // admins bypass ownership checks
  ownershipBypass: (user) => user.email?.endsWith('@example.com'),  // custom bypass predicate
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enforceOwnership` | `boolean` | `false` | Enable ownership checks on `findOne`/`update`/`remove` |
| `ownershipBypassPermissions` | `readonly string[]` | `[]` | Permission strings that grant full access (e.g. `['admin.access']`) |
| `ownershipBypass` | `(user: OwnershipUser) => boolean` | — | Custom predicate for bypassing ownership |

**Behavior**: When enforced and the user is authenticated:

- **`create`**: When `userOwnershipField` is configured and the ownership value is present in the payload, it must match the authenticated user's ID — otherwise a 404 is thrown (impersonation attempt). If the value is absent, it's auto-set to `user.id`. Bypass users (admin) can set any value.
- **`findOne` / `update` / `remove`**: Use a query builder scoped to the user's ownership (via `userOwnershipField` or `findMineQuery`). Non-owned records return 404, preventing existence leaks. Unauthenticated requests return 403 (fail-closed). Bypass users get full, unscoped access.

**`findMineQuery` and create**: `create` enforcement only applies when `userOwnershipField` is set. Ownership configured via `findMineQuery` (complex queries, joins) is a read-time concept and does not auto-enforce on create — use the `beforeCreate` hook for create-time checks in that scenario.

**Backward compatibility**: `enforceOwnership` defaults to `false` — existing services continue to use their current `findOne`/`update`/`remove` paths without any change.

---

## Audit Logging

### Setup

```typescript
// app.module.ts
@Module({
  imports: [NestCrudModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
```

### Manual Decoration

```typescript
@Post()
@Audit({ action: 'CREATE', entity: 'Post' })
create(@Body() dto: CreatePostDto) { ... }
```

### Automatic Decoration

CRUD controller factory auto-decorates `create`, `update`, `remove` with `@Audit()`. No manual work needed.

### Using AuditService Directly

```typescript
import { AuditService } from '@nest-util/nest-crud';

@Injectable()
export class BillingService {
  constructor(private readonly auditService: AuditService) {}

  async issueRefund(orderId: string, userId: string) {
    await this.auditService.logEntityAction('REFUND', 'Order', orderId, {
      userId,
      metadata: { source: 'billing-service' },
    });
  }
}
```

### AuditLogEntity Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `action` | string | Action performed (e.g. `'CREATE'`, `'UPDATE'`) |
| `entity` | string | Entity name (e.g. `'Post'`) |
| `entityId` | string | Entity ID |
| `userId` | string | User who performed the action |
| `tenantId` | string | Tenant ID (optional) |
| `metadata` | JSONB | Request body, params, query, response |
| `ip` | string | Client IP address |
| `userAgent` | string | Client user agent |
| `createdAt` | Date | Timestamp |

---

## Filtering

### Query Format

```
?filter[field_operator]=value
```

**Requires** Express query parser set to `'extended'`:

```typescript
// main.ts
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

### Supported Operators

| Operator | SQL | Example |
|---|---|---|
| `eq` | `= :val` | `?filter[name_eq]=John` |
| `ne` | `!= :val` | `?filter[name_ne]=John` |
| `cont` | `ILIKE '%val%'` | `?filter[name_cont]=oh` |
| `notcont` | `NOT ILIKE '%val%'` | `?filter[name_notcont]=oh` |
| `starts` | `ILIKE 'val%'` | `?filter[name_starts]=Jo` |
| `ends` | `ILIKE '%val'` | `?filter[name_ends]=hn` |
| `gte` | `>= :val` | `?filter[age_gte]=18` |
| `lte` | `<= :val` | `?filter[age_lte]=65` |
| `gt` | `> :val` | `?filter[age_gt]=18` |
| `lt` | `< :val` | `?filter[age_lt]=65` |
| `in` | `IN (:...val)` | `?filter[id_in]=1,2,3` |
| `nin` | `NOT IN (:...val)` | `?filter[id_nin]=1,2,3` |
| `isnull` | `IS NULL` / `IS NOT NULL` | `?filter[deletedAt_isnull]=true` |

### Grouping

```
?filter[and][0][name_cont]=oh&filter[and][1][age_gte]=18
?filter[or][0][name_eq]=John&filter[or][1][name_eq]=Jane
```

Groups can be nested arbitrarily.

### Safety

Field names are validated against `/^[A-Za-z][A-Za-z0-9_]*$/`. Only fields in `allowedFilters` are processed — unknown fields are silently ignored.

### Pagination

| Parameter | Default | Description |
|---|---|---|
| `page` | 1 | Page number (min 1) |
| `limit` | 10 | Items per page (min 1) |
| `orderBy` | — | Sort field (must be in `allowedSortFields`) |
| `orderDirection` | `'DESC'` | `'ASC'` or `'DESC'` |

---

## Testing Factory

Generate complete test suites for your CRUD service and controller with zero boilerplate.

### Service Tests

```typescript
import { crudServiceTests } from '@nest-util/nest-crud/testing';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

describe('PostService', () => {
  crudServiceTests({
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    allowedFilters: ['title'],
    userOwnershipField: 'authorId',
    test: {
      createPayload: { title: 'Hello', content: 'World' },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

This generates ~20 tests covering `findAll`, `findOne`, `create`, `update`, `remove`, `findMine`, `findAllWithCursor`, `findAuditLogs`, and disabled endpoints.

### Controller Tests

```typescript
import { crudControllerTests } from '@nest-util/nest-crud/testing';
import { CreateNestedCrudController } from '@nest-util/nest-crud';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

const PostControllerBase = CreateNestedCrudController(
  CreatePostDto, UpdatePostDto, Post,
  { enableFindMine: true }
);

describe('PostController', () => {
  crudControllerTests({
    controllerFactory: () => PostControllerBase,
    serviceClass: PostService,
    entity: Post,
    createDto: CreatePostDto,
    updateDto: UpdatePostDto,
    permissions: {
      findAll: 'posts.read',
      findOne: 'posts.readOne',
      create: 'posts.create',
      update: 'posts.update',
      remove: 'posts.delete',
      findAuditLogs: 'posts.audit',
      findMine: 'posts.read',
    },
    test: {
      createPayload: { title: 'Hello', content: 'World' },
      updatePayload: { title: 'Updated' },
    },
  });
});
```

This generates ~15 tests covering all endpoints, disabled endpoint guards, and permission metadata.

### Config Options

| Option | Description |
|---|---|
| `entity` | TypeORM entity class |
| `serviceClass` | Your service class |
| `createDto` / `updateDto` | DTO classes |
| `allowedFilters` | Fields available for filtering |
| `userOwnershipField` | Column for `findMine` ownership |
| `findMineQuery` | Custom query builder for complex ownership |
| `disabledEndpoints` | Endpoints to test as disabled |
| `hooks` | Hook configs to test |
| `toResponseDto` | Response transformer |
| `test.createPayload` | Sample create DTO |
| `test.updatePayload` | Sample update DTO |
| `test.mockEntity` | Custom mock entity data |
| `test.mockRepoOverrides` | Override mock repository methods |
| `authOptions` | Auth options passed to the controller test module |

### Mock Utilities

```typescript
import {
  createMockRepository,
  createMockQb,
  createDefaultMockEntity,
} from '@nest-util/nest-crud/testing';

// Auto-generate mock entity from TypeORM metadata
const mock = createDefaultMockEntity(Post);
// Returns: { id: 1, title: 'mock_title', content: 'mock_content', authorId: 1 }

// Create a mock TypeORM repository
const repo = createMockRepository(Post);

// Create a mock query builder
const qb = createMockQb();
```

---

## Guards & Decorators

### From `@nest-util/nest-auth`

| Decorator/Guard | Description |
|---|---|
| `JwtAuthGuard` | Validates JWT token, skips `@Public()` routes |
| `PermissionsGuard` | Checks `@Permissions()` against user's resolved permissions; honors `superAdminPermission` |
| `ApiKeyGuard` | Authenticates via `x-api-key` header when present (passes through if absent) |
| `@Public()` | Marks route as public (skips JWT validation) |
| `@CurrentUser()` | Param decorator — extracts `request.user` |
| `@Permissions(...permissions)` | Sets required permissions for the route |

### From `@nest-util/nest-crud`

| Decorator | Description |
|---|---|
| `@Audit({ action, entity })` | Marks handler for audit logging |
| `@Message('verb')` | Sets action word in response (e.g. `'created'`, `'fetched'`) |
| `@EntityName({ singular, plural })` | Sets entity name in response |

### Usage Example

```typescript
@Controller('profile')
export class ProfileController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.access')
  adminOnly() {
    return { ok: true };
  }

  @Get('public')
  @Public()
  publicRoute() {
    return { ok: true };
  }
}
```

---

## Response Wrapping

`ResponseInterceptor` transforms all responses into:

```json
{
  "message": "Posts fetched successfully",
  "data": [...],
  "meta": { "page": 1, "limit": 10, "total": 42 },
  "status": "success"
}
```

- `@Message('fetched')` → action word
- `@EntityName({ singular: 'Post', plural: 'Posts' })` → entity name
- If data is an array, plural is used; otherwise singular
- Fallback: `Action: 'Request successful'`, `Name: 'Resource'/'Resources'`

---

## Error Handling

`TypeOrmExceptionFilter` catches `QueryFailedError`:

| Database | Error Code | HTTP Status | Message |
|---|---|---|---|
| Postgres | `23505` | 422 | `"Duplicate entry: ..."` |
| MySQL | `1062` | 422 | `"Duplicate entry: ..."` |
| Any | Other | 500 | `"Internal server error"` |

**ALWAYS** register as a global filter:

```typescript
app.useGlobalFilters(new TypeOrmExceptionFilter());
```

---

## Permission Registry

Define available permissions for your resources:

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

Use with controller:

```typescript
permissions: buildCrudPermissionsFromRegistry(permissionRegistry, {
  resource: 'posts',
})
```

This generates permission keys like `posts.read`, `posts.create`, etc.

### Guardrail: Permission Registry Strict Mode

By default, `buildCrudPermissionsFromRegistry` throws at startup if a CRUD permission is missing from the registry. Set `strict: false` to silently skip:

```typescript
buildCrudPermissionsFromRegistry(registry, {
  resource: 'posts',
  strict: false,  // don't throw on missing permissions
})
```

### RBAC Configuration (`rbac` option)

| Option | Type | Default | Description |
|---|---|---|---|
| `directPermissionsKey` | `string` | `'permissions'` | Key on the user holding direct permissions |
| `rolesKey` | `string` | `'roles'` | Key on the user holding role assignments |
| `userRolesRelation` | `string` | — | Relation to eager-load (e.g. `'userRoles'`) |
| `rolePermissionsKey` | `string` | `'permissions'` | Key on a role holding its permissions |
| `nestedRoleKey` | `string` | `'role'` | Key on a user-role row holding the role object |
| `requireAllPermissions` | `boolean` | `true` | `false` = any matching permission suffices |
| `permissionEvaluator` | `(ctx) => boolean` | — | Custom permission evaluation function |
| `superAdminPermission` | `string` | — | **Bypasses all `@Permissions()` checks** when present in the user's resolved permissions |

```typescript
rbac: {
  superAdminPermission: 'admin.access',  // users with this permission skip all @Permissions() checks
  requireAllPermissions: true,
}
```

`superAdminPermission` is checked before the standard all/any matching, so a super admin passes every guarded route even if `requireAllPermissions` is set.

---

## Auth DTOs with Swagger

```typescript
import { ApiProperty } from '@nestjs/swagger';

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

## Complete Example

### main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalFilters(new TypeOrmExceptionFilter());

  // REQUIRED for filter query parameters to parse nested objects
  app.getHttpAdapter().getInstance().set('query parser', 'extended');

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API with Nest-Util')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

### app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestCrudModule, ResponseInterceptor, AuditInterceptor } from '@nest-util/nest-crud';
import { AuthModule } from '@nest-util/nest-auth';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { User } from './user/user.entity';
import { Post } from './post/post.entity';
import { PostModule } from './post/post.module';
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto';
import { permissionRegistry } from './auth/permission-registry';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, Post]),
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: process.env.JWT_SECRET,
      refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      relations: ['userRoles', 'userRoles.role'],
      rbac: {
        userRolesRelation: 'userRoles',
        rolesKey: 'userRoles',
        nestedRoleKey: 'role',
      },
      permissionRegistry,
    }),
    NestCrudModule,
    PostModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
```

### post.entity.ts

```typescript
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

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

### post.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(@InjectRepository(Post) repository: Repository<Post>) {
    super({
      repository,
      allowedFilters: ['title', 'authorId'],
      allowedSortFields: ['createdAt', 'title'],
      include: ['author'],
      userOwnershipField: 'authorId',
    });
  }
}
```

### post.controller.ts

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  PermissionsGuard,
  buildCrudPermissionsFromRegistry,
} from '@nest-util/nest-auth';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { permissionRegistry } from '../auth/permission-registry';

const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, {
      resource: 'posts',
    }),
    enableFindMine: true,
  }
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

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

---

## NestFileModule (S3/MinIO File Uploads)

`@nest-util/nest-file` handles file uploads to any S3-compatible object store using **presigned URLs** — files stream directly from the client to S3, so nothing goes through your NestJS server.

### Setup

```typescript
// app.module.ts
import { NestFileModule } from '@nest-util/nest-file';

@Module({
  imports: [
    AuthModule.forRoot({ /* ... */ }),   // required: guards + @CurrentUser()
    NestFileModule.forRoot({
      s3: {
        endpoint: process.env.S3_ENDPOINT,       // e.g. http://localhost:9000 (MinIO)
        region: process.env.S3_REGION ?? 'us-east-1',
        bucket: process.env.S3_BUCKET,
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        forcePathStyle: true,                    // REQUIRED for MinIO
        publicUrl: process.env.S3_PUBLIC_URL,    // optional public CDN/base URL
      },
      upload: {
        maxFileSize: 10 * 1024 * 1024,           // 10 MB (optional)
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/*', 'application/pdf'],
        pathPrefix: 'uploads',                   // S3 key prefix (default 'uploads')
        presignedUrlExpiresIn: 3600,             // seconds (default 3600)
      },
      controller: {
        enable: true,                            // default: true
        path: 'files',                           // default: 'files'
        permissions: {                           // RBAC keys applied via PermissionsGuard
          upload: 'files.upload',
          download: 'files.download',
          list: 'files.list',
          remove: 'files.delete',
        },
      },
    }),
    // ...
  ],
})
export class AppModule {}
```

`forRootAsync` is also available (`useFactory` + `inject`) for config-service-based setup. The module is `@Global()` and exports `FileService`, `S3Service`, and the options token.

### Presigned Upload Flow

1. **`POST /files/upload-url`** — client sends `RequestUploadDto` (`fileName`, `mimeType`, `folder?`); server returns `{ uploadUrl, key, fileId }` and creates a pending `FileEntity`.
2. Client **PUTs the file bytes directly to `uploadUrl`** (presigned S3 URL).
3. **`POST /files/confirm`** — client sends `ConfirmUploadDto` (`fileId`, `key`); server verifies the object exists in S3, stores the public URL, and returns the confirmed `FileEntity`.

### Auto-Registered Endpoints

All routes are guarded by `JwtAuthGuard` + `PermissionsGuard` (skip `permissions` config for open access):

| Endpoint | Method | Permission Key | Description |
|---|---|---|---|
| `POST /files/upload-url` | POST | `upload` | Request presigned upload URL |
| `POST /files/confirm` | POST | `upload` | Confirm upload completion |
| `GET /files/:id/download` | GET | `download` | Get presigned download URL |
| `GET /files/mine` | GET | `list` | Current user's files (paginated) |
| `GET /files` | GET | `list` | List all files (paginated) |
| `GET /files/:id` | GET | `list` | File metadata |
| `DELETE /files/:id` | DELETE | `remove` | Delete file from S3 + DB |

### `FileService` Methods

| Method | Description |
|---|---|
| `requestUpload(dto, userId)` | Validate MIME, generate stored name + S3 key, return presigned upload URL |
| `confirmUpload(dto)` | Verify object exists in S3, set public URL on the entity |
| `getDownloadUrl(fileId)` | Return a presigned download URL |
| `getFile(fileId)` | Return `FileEntity` metadata |
| `deleteFile(fileId)` | Delete from S3 and remove DB record |
| `findAll(query?)` | Paginated list of all files |
| `findMine(userId, query?)` | Paginated list of a user's files |

### `S3Service` Methods

| Method | Description |
|---|---|
| `generatePresignedUploadUrl({ key, contentType, expiresIn? })` | Presigned PUT URL |
| `generatePresignedDownloadUrl(key, expiresIn?)` | Presigned GET URL |
| `uploadBuffer(key, buffer, contentType)` | Server-side upload (multipart middleware not required) |
| `deleteObject(key)` | Delete object |
| `objectExists(key)` | Head-object existence check |
| `getClient()` / `getBucket()` | Raw S3 client / bucket name |

### `FileEntity` Fields

`id` (UUID), `originalName`, `storedName`, `mimeType`, `size`, `bucket`, `key`, `url`, `userId`, `metadata` (JSONB), `createdAt`, `updatedAt`.

### File Naming Helpers

`generateStoredName(name)` → `{timestamp}-{sanitized}`; `generateS3Key(storedName, pathPrefix?)` → `{prefix}/{storedName}` (default prefix `uploads`). `isImageMime(mime)` / `getMimeTypeExtension(mime)` are exported for image detection.

### Guardrails

1. **`autoLoadEntities: true`** must be set on `TypeOrmModule.forRoot()` for `FileEntity` to be registered.
2. **`forcePathStyle: true`** is required for MinIO/S3-compatible local endpoints.
3. `@nest-util/nest-auth` must be installed — the auto controller uses `JwtAuthGuard`, `PermissionsGuard`, and `@CurrentUser()`.
4. MIME whitelist supports wildcards (`image/*`). An empty/absent whitelist allows all types.
5. `maxFileSize` is advisory metadata only — enforce limits with the presigned PUT or an S3 bucket policy if strict.

---

## NestPaymentModule (Checkout, Subscriptions, Refunds)

`@nest-util/nest-payment` is a **provider-agnostic** payment layer. You implement a thin `PaymentProvider` for your gateway (Stripe, Chapa, etc.); the module handles DB records, idempotency, webhooks, status transitions, and reconciliation.

### Provider Interface

```typescript
import { PaymentProvider, PaymentStatus, WebhookEvent } from '@nest-util/nest-payment';

export class ChapaProvider implements PaymentProvider {
  readonly id = 'chapa';

  createCheckoutSession(params) {
    // → { providerReference, checkoutUrl, providerPaymentId?, metadata? }
  }
  createSubscription?(params)      { /* optional */ }
  cancelSubscription?(id)          { /* optional */ }
  createRefund?(params)            { /* optional */ }
  parseWebhookEvent(rawBody, headers): Promise<WebhookEvent> {
    // normalize provider payload → WebhookEvent
  }
  verifyWebhookSignature?(rawBody, headers): boolean {
    // return true if valid
  }
  getPaymentStatus?(providerPaymentId): Promise<PaymentStatus | null> {
    // used by reconciliation
  }
}
```

### Setup

```typescript
import { NestPaymentModule } from '@nest-util/nest-payment';
import { ChapaProvider } from './providers/chapa.provider';

@Module({
  imports: [
    AuthModule.forRoot({ /* ... */ }),   // required: guards + @CurrentUser()
    NestPaymentModule.forRoot({
      providers: [new ChapaProvider()],
      webhook: {
        enable: true,                    // default: true
        path: 'webhook',                 // default: 'webhook'
        rawBody: true,                   // default: true
        deduplicate: true,               // in-memory dedup, default: true
        deduplicationTtlMs: 300000,      // default 5 min
      },
      reconciliation: {
        enable: true,                    // default: true
        staleAfterMs: 600000,            // default 10 min
      },
      onWebhook: async (event, rawBody) => { /* notify order service */ },
      onReconciliationMismatch: async (payment, providerStatus) => { /* alert */ },
      controller: {
        enable: true,                    // default: true
        path: 'payments',                // default: 'payments'
        permissions: {
          checkout: 'payments.create',
          list: 'payments.read',
          refund: 'payments.refund',
          subscriptions: 'payments.subscriptions',
          reconcile: 'payments.reconcile',
        },
      },
    }),
    // ...
  ],
})
export class AppModule {}
```

`forRootAsync` is also available. The module is `@Global()` and exports `PaymentService`, `SubscriptionService`, `RefundService`, and the options token.

### Auto-Registered Endpoints

| Endpoint | Method | Auth | Permission Key | Description |
|---|---|---|---|---|
| `POST /payments/webhook/:provider` | POST | `@Public()` | — | Provider webhook (signature-verified, routed by event type) |
| `POST /payments/checkout` | POST | JWT+Perm | `checkout` | Create checkout session |
| `GET /payments` | GET | JWT+Perm | `list` | List payments (`page`, `limit`, `provider`, `status`) |
| `GET /payments/mine` | GET | JWT+Perm | `list` | Current user's payments |
| `GET /payments/:id` | GET | JWT+Perm | `list` | Payment by ID |
| `POST /payments/:id/refund` | POST | JWT+Perm | `refund` | Refund a `succeeded` payment |
| `GET /payments/subscriptions` | GET | JWT+Perm | `list` | List subscriptions |
| `POST /payments/subscriptions` | POST | JWT+Perm | `subscriptions` | Create subscription |
| `DELETE /payments/subscriptions/:id` | DELETE | JWT+Perm | `subscriptions` | Cancel subscription |
| `POST /payments/reconcile` | POST | JWT+Perm | `reconcile` | Reconcile stale payments |
| `POST /payments/reconcile/:id` | POST | JWT+Perm | `reconcile` | Reconcile a single payment |

### Status Enums

| Entity | Statuses |
|---|---|
| `PaymentEntity` | `pending`, `processing`, `succeeded`, `failed`, `refunded`, `canceled` |
| `SubscriptionEntity` | `pending`, `active`, `past_due`, `canceled`, `trialing` |
| `RefundEntity` | `pending`, `succeeded`, `failed` |

Only **forward transitions** are applied from webhooks (e.g. `pending → succeeded`, never `succeeded → pending`). Refunds only allowed on `succeeded` payments; fully refunded payments flip to `refunded`.

### Service Methods

**`PaymentService`** — `createCheckout(userId, dto)`, `handleWebhook(event)`, `findOne(id)`, `findByProviderPaymentId(provider, id)`, `findAll(query?)`, `findMine(userId, query?)`, `reconcilePayment(id)`, `reconcileStalePayments({ staleAfterMs? })`, `getProvider(id)`.

**`SubscriptionService`** — `create(userId, dto)`, `handleWebhook(event)`, `cancel(id)`, `findOne(id)`, `findAll(query?)`, `findMine(userId, query?)`.

**`RefundService`** — `create(dto)`, `handleWebhook(event)`, `findOne(id)`, `findByPaymentId(paymentId)`, `findAll(query?)`.

### Idempotency

All three services honor `idempotencyKey`: if a payment/subscription/refund with the same key already exists, the existing record is returned instead of creating a duplicate. Always pass one for retry-safe flows.

### Guardrails

1. **Webhook raw body**: `rawBody` handling needs Nest's raw-body capture. Create the app with `NestFactory.create(AppModule, { rawBody: true })` (or configure `bodyParser` accordingly) — the controller reads `req.rawBody`.
2. **Provider capability checks**: `createSubscription` throws if the provider doesn't implement `createSubscription`; same for refunds and cancellation. Only implement the methods your gateway supports.
3. The webhook route is `@Public()` — do **not** guard it, but the provider's `verifyWebhookSignature` is invoked when implemented; requests fail with 400 on invalid signatures.
4. Reconciliation requires providers to implement `getPaymentStatus`.
5. `autoLoadEntities: true` must be set for `PaymentEntity`, `SubscriptionEntity`, and `RefundEntity` registration.
6. `@nest-util/nest-auth` must be installed — the auto controller uses `JwtAuthGuard`, `PermissionsGuard`, and `@CurrentUser()`.

---

## Security Rules

These rules are **mandatory** — violating any of them will cause data leaks, runtime errors, or security vulnerabilities.

1. **ALWAYS** use `select: false` on `password`, `refreshToken`, and `accessToken` columns in your User entity
2. **ALWAYS** set Express query parser to `'extended'` for filter query parameters to parse nested objects
3. **ALWAYS** register `TypeOrmExceptionFilter` as a global filter
4. **ALWAYS** register `ResponseInterceptor` and `AuditInterceptor` as global interceptors via `APP_INTERCEPTOR`
5. **ALWAYS** set `autoLoadEntities: true` on `TypeOrmModule.forRoot()` — required for `AuditLogEntity` registration
6. **ALWAYS** add `implements IBaseController<CD, UD, RD>` to controllers extending `CreateNestedCrudController(...)`
7. **NEVER** expose password/token fields in API responses — use `toResponseDto` to strip sensitive fields
8. **NEVER** hardcode JWT secrets in source code — use environment variables
9. **NEVER** set `synchronize: true` in production — use TypeORM migrations
10. OTP `deliverCode` callback **MUST** be provided when `otp.enabled: true`
11. Password Reset `deliverToken` callback **MUST** be provided when `passwordReset.enabled: true`
12. `@Public()` decorator works at both handler and class level
13. `disabledRoutes` in AuthModule accepts: `'register'`, `'login'`, `'otp/request'`, `'otp/login'`, `'password-reset/request'`, `'password-reset/reset'`
14. **ALWAYS** ensure `@nest-util/nest-auth` is installed if using `enableFindMine` — the controller factory imports `@CurrentUser()` from it
15. Permission registry strict mode (default) throws at startup if a CRUD permission is missing — set `strict: false` to skip
16. **ALWAYS** set `forcePathStyle: true` when using `NestFileModule` with MinIO / local S3-compatible endpoints
17. **ALWAYS** create the app with `NestFactory.create(AppModule, { rawBody: true })` when using `NestPaymentModule` — the webhook controller reads `req.rawBody` for signature verification
18. **NEVER** guard the payment webhook route — it is `@Public()` and relies on the provider's `verifyWebhookSignature`
19. **ALWAYS** pass `idempotencyKey` for retry-safe payment/subscription/refund flows
20. API keys are only returned once at creation — hash is stored, never the raw key

---

## Troubleshooting

### TS2742: Inferred type is not portable

Add `implements IBaseController<CD, UD, RD>` to your controller class:

```typescript
export class PostController extends PostCrudControllerBase
  implements IBaseController<CreatePostDto, UpdatePostDto, Post>
```

### Filtering not working

1. Set `app.getHttpAdapter().getInstance().set('query parser', 'extended')` in `main.ts`
2. Whitelist filterable fields via `allowedFilters` in service options
3. Field names must match `/^[A-Za-z][A-Za-z0-9_]*$/`

### Auth token issues

1. User entity must have `accessToken` and `refreshToken` fields (even if nullable)
2. JWT secret must be consistent across all services
3. Token fields must use `select: false` on `@Column()`
4. Refresh token expects `refreshToken` in request body

### TypeORM Duplicate Key Errors

Register `TypeOrmExceptionFilter` as a global filter. It maps Postgres code `23505` to HTTP 422.

### Audit Logs Not Appearing

1. `NestCrudModule` must be imported in the root module
2. `AuditInterceptor` must be registered as a global interceptor via `APP_INTERCEPTOR`
3. Handlers must have `@Audit({ action: '...' })` decorator (CRUD factory auto-applies this)

### findMine returns 404

1. Ensure `enableFindMine: true` is passed to `CreateNestedCrudController`
2. Ensure service configures `userOwnershipField` or `findMineQuery`
3. Ensure `@nest-util/nest-auth` is installed (for `@CurrentUser()` decorator)

### Hooks not firing

1. Ensure hooks are passed as `CrudHookConfig` objects with a `handler` property
2. Check that hook names match exactly: `beforeCreate`, `afterCreate`, etc.
3. Hook context objects are different for each hook — check the hooks table above

### Testing factory errors

1. Ensure `@nest-util/nest-crud/testing` is imported (not the main index)
2. The factory creates `NestCrudService` directly — your service constructor must accept `@InjectRepository`
3. Mock repositories are provided via NestJS DI using `getRepositoryToken(entity)`

### File uploads fail against MinIO (403/404)

1. Set `forcePathStyle: true` in the `s3` options — MinIO does not support virtual-hosted-style buckets
2. Verify the bucket exists and the access key has `PutObject`/`GetObject`/`DeleteObject` permissions
3. For `confirmUpload`, confirm the exact `key` returned by `requestUpload` was used for the PUT

### Payments stuck in `pending` / webhooks not arriving

1. Confirm the app was created with `NestFactory.create(AppModule, { rawBody: true })`
2. Check the provider's `parseWebhookEvent` returns `providerPaymentId` so the webhook matches the DB record
3. Ensure the provider is registered in `options.providers` with the same `id` used to create the checkout
4. If signature verification fails, the route returns 400 — check `verifyWebhookSignature` reads the right headers

### Reconciliation says "provider does not support status checks"

1. Implement `getPaymentStatus` on your `PaymentProvider`
2. Only `pending`/`processing`/`succeeded` payments are reconcilable

### API key auth not working

1. Ensure `apiKey.enabled: true` in `AuthModule.forRoot` and the header name matches (`x-api-key` by default)
2. Add `ApiKeyGuard` to the route guards you want key auth on (`JwtAuthGuard, PermissionsGuard, ApiKeyGuard`)
3. Register `ApiKeyEntity`/`ApiKeyRoleEntity` in your TypeORM config/migrations
