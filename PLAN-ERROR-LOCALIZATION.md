# Plan: Standardized, Localized, Generic Error System — `@nest-util/nest-error`

> Status: Design / Plan (not yet implemented)
> Scope: New `@nest-util/nest-error` package + migration of all error throws across
> `@nest-util/nest-crud`, `@nest-util/nest-auth`, `@nest-util/nest-notify`,
> `@nest-util/nest-payment`, `@nest-util/nest-file`, plus demo-api wiring.

---

## 1. Goal

Provide a single, reusable mechanism for **every** error in nest-util to have a stable
**key (code)** and to be rendered as a **standardized, localized, generic** error response
driven by a **JSON messages config**.

- The active language is resolved from the `Accept-Language` HTTP header.
- Messages support `{placeholder}` interpolation.
- Messages are **generic but understandable**: the `code` is precise for developers; the
  human `message` never leaks internals (SQL, stack traces, constraint names, raw user input).
- Existing thrown errors across all libraries are migrated to keys so they become localizable.
- Success-response messages (the `ResponseInterceptor` `message` field) are localized too.

---

## 2. Security principle: generic but understandable

- **`code`** = precise machine key (e.g. `AUTH_INVALID_CREDENTIALS`). This is the developer's
  signal — stable, grep-able, and safe to log.
- **`message`** = generic, human-readable, localized text (e.g. "Invalid credentials"). **No
  internals are ever leaked to the client.**
- **`{placeholder}` interpolation is restricted to safe, known values only**: entity *type* name,
  field name, counts, TTL seconds. **User-supplied input is never interpolated** into messages.
- `INTERNAL_ERROR` / `UNKNOWN_ERROR` → `"An unexpected error occurred. Please try again later."`
  with **no** stack/detail in the response. The full error (code, params, original error, stack)
  is still **logged server-side** for debugging.
- `DB_DUPLICATE_ENTRY` returns the generic `"A record with this value already exists."` The
  previous `driverError.detail` leak (column / constraint / values) is **removed from the
  response by default** and only written to the server log.
- `details` is populated **only** with deliberately safe, structured data (e.g. validation field
  names, `retryAfter` seconds) — never raw DB/SQL/stack. Controlled by the `debug` flag.

---

## 3. Key design decisions

### 3.1 `keyed()` returns the real NestJS exception class (preserves tests)
`keyed(status, ErrorKey.X, params, safeDetails)` returns the **actual matching NestJS exception
class** (`NotFoundException`, `BadRequestException`, `ForbiddenException`, …) whose JSON response
carries `{ errorKey, params, message }`.

Because the thrown object *is* a `NotFoundException`, all existing spec assertions such as
`expect(...).rejects.toThrow(NotFoundException)` keep passing. This makes the ~120-site migration
mechanical and low-risk.

```ts
function keyed(
  status: number,
  code: string,
  params?: Record<string, unknown>,
  safeDetails?: Record<string, unknown>,
): HttpException {
  const NestClass = pickNestClass(status); // 404->NotFoundException, 400->BadRequestException, ...
  const message = defaultMessages[code] ?? 'An unexpected error occurred';
  return new NestClass({ errorKey: code, params, details: safeDetails ?? null, message });
}
```

An `AppError extends HttpException` class is also exported for **app-level** custom errors; it is
caught and localized identically by the filter.

### 3.2 Catch-all `LocalizedExceptionFilter`
A single `@Catch()` (catch-everything) exception filter:
- Reads `errorKey` off `HttpException.getResponse()` and localizes via `I18nService`.
- Handles `QueryFailedError` → maps Postgres `23505` / MySQL `1062` to `DB_DUPLICATE_ENTRY`
  (parsing `driverError.detail` for the **server log only**).
- Maps any other `HttpException` without `errorKey` to a status-based fallback key
  (`VALIDATION_FAILED` for 400, `HTTP_404` for 404, `UNKNOWN_ERROR` otherwise) so **every**
  response still carries a `code`.
- Catches unknown `Error` → `INTERNAL_ERROR` (generic message, full error logged server-side).
- Always strips `details`/`params`/stack from the client response unless `debug: true`.

This **supersedes** the existing `TypeOrmExceptionFilter`. `TypeOrmExceptionFilter` is kept for
backward compatibility but the demo (and new apps) swap to `LocalizedExceptionFilter`.

### 3.3 Language resolution
`AcceptLanguageResolver` negotiates the language from the `Accept-Language` header using simple
q-value parsing (no new dependency). Configurable: `supportedLangs`, `defaultLang`, and optional
`x-lang` header override (`allowHeaderOverride`).

---

## 4. New package: `libs/nest-error`

### 4.1 File layout
```
libs/nest-error/
  package.json
  project.json
  jest.config.cts
  README.md
  tsconfig.json / tsconfig.lib.json / tsconfig.spec.json
  src/
    index.ts
    lib/
      nest-error.module.ts            # forRoot(options) registers I18nService + APP_FILTER
      constants/
        error-keys.ts                # ErrorKey registry (single source of truth)
        default-messages.ts          # en generic defaults (Record<ErrorKey, string>)
        en.json                      # same content, JSON form for "pass a JSON" theme
        http-status-map.ts           # status -> NestJS exception class
      interfaces/
        error-response.interface.ts
        localization-options.interface.ts
        i18n.interface.ts
      services/
        i18n.service.ts              # translate(code, params, lang), hasKey, fallback
        lang-resolver.service.ts
      resolvers/
        accept-language.resolver.ts
      filters/
        localized-exception.filter.ts
      helpers/
        keyed-error.factory.ts       # keyed() + AppError
      decorators/
        localized-message.decorator.ts
```

### 4.2 `package.json` (excerpt)
```json
{
  "name": "@nest-util/nest-error",
  "version": "1.0.0",
  "dependencies": { "tslib": "^2.8.1" },
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "express": "^5.2.1"
  }
}
```
Registered in `pnpm-workspace.yaml` and given an Nx `project.json` so
`pnpm run check` (build / lint / typecheck / test) covers it.

### 4.3 Options interface
```ts
interface LocalizationOptions {
  messages: Record<string, Record<string, string>>; // JSON user passes: lang -> code -> template
  defaultLang?: string;          // 'en'
  supportedLangs?: string[];     // ['en','am', ...]
  fallbackToDefault?: boolean;   // true
  allowHeaderOverride?: boolean; // x-lang header; default false
  debug?: boolean;               // false in prod: when true, include details/params/stack in response
}
```
The user's `messages` JSON is **deep-merged over** the library's generic `defaultMessages`, so an
app only supplies the languages/overrides it cares about.

### 4.4 Standardized error response shape
```json
{
  "status": "error",
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid credentials",
  "statusCode": 401,
  "details": null,
  "timestamp": "2026-08-14T10:00:00.000Z",
  "path": "/api/auth/login"
}
```
`details` is `null` by default and only populated with safe, structured data when explicitly
provided and `debug` allows it.

---

## 5. Error key registry (generic English defaults)

> Every key below gets a generic English default in `default-messages.ts`. Apps extend per
> language via the JSON config. Namespaced `UPPER_SNAKE`. This list is derived from the actual
> `throw` sites found across the libraries.

### 5.1 CRUD (`@nest-util/nest-crud`)
| Key | Generic EN | Raised when |
|---|---|---|
| `CRUD_RESOURCE_NOT_FOUND` | The requested resource was not found | `findOne`/`remove`/missing id (`nest-crud.service.ts:696,734,918,931,1086,1128`) |
| `CRUD_RELATION_NOT_FOUND` | The referenced related record does not exist | relation id points to missing entity (`:217`) |
| `CRUD_FORBIDDEN` | You are not allowed to perform this action | ownership enforced / generic 403 (`:715,923`) |
| `CRUD_FIND_MINE_NOT_CONFIGURED` | This resource does not support the requested scope | `findMine` called but unconfigured (`:577`) |
| `CRUD_INVALID_STATUS` | The provided status is not allowed | invalid initial status on create (`:451`) |
| `CRUD_STATUS_TRANSITION_INVALID` | The requested status change is not allowed | illegal status pipeline transition (`:485,493`) |
| `CRUD_STATUS_TRANSITION_FORBIDDEN` | You do not have permission to change this status | missing transition permission (`:501,923`) |
| `CRUD_INVALID_FILTER` | The provided filter is not allowed | field not whitelisted / invalid filter syntax |
| `CRUD_APPROVAL_NOT_CONFIGURED` | Approvals are not enabled for this resource | approval action on unconfigured pipeline |
| `CRUD_APPROVAL_FORBIDDEN` | You do not have permission to perform this approval action | missing approve/reject/modify permission |
| `CRUD_APPROVAL_INVALID_TRANSITION` | The requested approval change is not allowed | illegal approval state change |

### 5.2 Auth (`@nest-util/nest-auth`)
| Key | Generic EN |
|---|---|
| `AUTH_INVALID_CREDENTIALS` | Invalid credentials |
| `AUTH_USER_ALREADY_EXISTS` | An account with this identifier already exists |
| `AUTH_USER_NOT_FOUND` | The requested account was not found |
| `AUTH_UNAUTHORIZED` | Authentication is required |
| `AUTH_PERMISSION_DENIED` | You do not have permission to perform this action |
| `AUTH_TOKEN_INVALID` | The provided token is invalid |
| `AUTH_TOKEN_EXPIRED` | The provided token has expired |
| `AUTH_TOKEN_REUSED` | The provided token has been revoked |
| `AUTH_ACCOUNT_NOT_VERIFIED` | This account is not verified |
| `AUTH_REFRESH_TOKEN_REQUIRED` | A refresh token is required |
| `AUTH_LOGOUT_FAILED` | Unable to sign out at this time |
| `AUTH_CURRENT_PASSWORD_INCORRECT` | The current password is incorrect |
| `AUTH_PASSWORD_NOT_SET` | This account does not have a password set |
| `AUTH_NO_UPDATABLE_FIELDS` | No updatable fields were provided |
| `AUTH_REGISTER_FIELD_NOT_ALLOWED` | One or more provided fields are not allowed |
| `AUTH_OTP_DELIVERY_FAILED` | Unable to send the verification code |
| `AUTH_OTP_INVALID` | The verification code is invalid |
| `AUTH_OTP_EXPIRED` | The verification code has expired |
| `AUTH_OTP_RATE_LIMITED` | Too many attempts. Please try again later |
| `AUTH_PASSWORD_RESET_TOKEN_INVALID` | The password reset token is invalid |
| `AUTH_PASSWORD_RESET_TOKEN_EXPIRED` | The password reset token has expired |
| `AUTH_PASSWORD_RESET_TOKEN_REQUIRED` | A password reset token is required |
| `AUTH_PASSWORD_RESET_DELIVERY_FAILED` | Unable to send the password reset link |
| `AUTH_ROLE_NAME_REQUIRED` | A role name is required |
| `AUTH_ROLE_ALREADY_EXISTS` | A role with this name already exists |
| `AUTH_ROLE_NOT_FOUND` | The requested role was not found |
| `AUTH_ROLE_PERMISSIONS_REQUIRED` | Permissions are required |
| `AUTH_ROUTE_DISABLED` | This route is disabled |
| `AUTH_ONBOARDING_NOT_ENABLED` | Onboarding is not enabled |
| `AUTH_ONBOARDING_TOKEN_REQUIRED` | An onboarding token is required |
| `AUTH_ONBOARDING_TOKEN_INVALID` | The onboarding token is invalid |
| `AUTH_ONBOARDING_TOKEN_USED` | The onboarding token has already been used |

### 5.3 Notify / Payment / File
| Key | Generic EN |
|---|---|
| `NOTIFY_FCM_NOT_CONFIGURED` | Push notifications are not configured |
| `NOTIFY_SMTP_NOT_CONFIGURED` | Email notifications are not configured |
| `NOTIFY_DEVICE_TOKEN_INVALID` | The device token is invalid |
| `NOTIFY_PUSH_FAILED` | Unable to deliver the push notification |
| `NOTIFY_EMAIL_DELIVERY_FAILED` | Unable to send the email |
| `PAYMENT_PROVIDER_NOT_CONFIGURED` | Payments are not configured |
| `PAYMENT_CHECKOUT_FAILED` | Unable to start the checkout session |
| `PAYMENT_SUBSCRIPTION_NOT_FOUND` | The requested subscription was not found |
| `PAYMENT_REFUND_FAILED` | Unable to process the refund |
| `PAYMENT_WEBHOOK_INVALID` | The webhook payload is invalid |
| `FILE_NOT_FOUND` | The requested file was not found |
| `FILE_TOO_LARGE` | The uploaded file is too large |
| `FILE_INVALID_TYPE` | The uploaded file type is not allowed |
| `FILE_UPLOAD_FAILED` | Unable to upload the file |

### 5.4 Database / generic
| Key | Generic EN |
|---|---|
| `DB_DUPLICATE_ENTRY` | A record with this value already exists |
| `DB_QUERY_FAILED` | A database error occurred |
| `VALIDATION_FAILED` | Some of the provided data is invalid |
| `INTERNAL_ERROR` | An unexpected error occurred. Please try again later |
| `UNKNOWN_ERROR` | An unexpected error occurred |

---

## 6. JSON config example (user-supplied)

```jsonc
// apps/demo-api/src/config/error-messages.json
{
  "en": {
    "CRUD_RESOURCE_NOT_FOUND": "The requested resource was not found",
    "CRUD_FORBIDDEN": "You are not allowed to perform this action",
    "AUTH_UNAUTHORIZED": "Authentication is required",
    "CRUD_RELATION_NOT_FOUND": "The referenced related record does not exist",
    "CRUD_INVALID_STATUS": "The provided status is not allowed",
    "CRUD_STATUS_TRANSITION_INVALID": "The requested status change is not allowed",
    "CRUD_STATUS_TRANSITION_FORBIDDEN": "You do not have permission to change this status",
    "DB_DUPLICATE_ENTRY": "A record with this value already exists",
    "VALIDATION_FAILED": "Some of the provided data is invalid",
    "INTERNAL_ERROR": "An unexpected error occurred. Please try again later"
  },
  "am": {
    "CRUD_RESOURCE_NOT_FOUND": "የቀየረው ሀብት አልተገኘም",
    "CRUD_FORBIDDEN": "ይህን እርምጃ ለመውሰድ ፍቃድ የለህም",
    "AUTH_UNAUTHORIZED": "ማረጋገጻ ያስፈልግዎታል",
    "CRUD_RELATION_NOT_FOUND": "የተገለጸው የተዛመደ ሀብት አልተገኘም",
    "CRUD_INVALID_STATUS": "የቀረበው ሁኔታ አይፈቀድም",
    "CRUD_STATUS_TRANSITION_INVALID": "የተጠየቀው የሁኔታ ለውጥ አይፈቀድም",
    "CRUD_STATUS_TRANSITION_FORBIDDEN": "ይህን ሁኔታ ለመቀየር ፍቃድ የለህም",
    "DB_DUPLICATE_ENTRY": "በዚህ እሴት ሌላ መዝገብ አስቀድሞ አለ",
    "VALIDATION_FAILED": "የቀረቡት መረጃ አንዳንዶቹ ልክ ያልሆኑ ናቸው",
    "INTERNAL_ERROR": "ያልተጠበቀ ስህተት ተከስቷል። እባክዎ ቆይተው እንደገና ይሞክሩ"
  }
}
```

```ts
// apps/demo-api/src/app/app.module.ts
import { LocalizationModule } from '@nest-util/nest-error';
import errorMessages from './config/error-messages.json';

@Module({
  imports: [
    // ...TypeOrmModule, AuthModule.forRoot(...), NestCrudModule, etc.
    LocalizationModule.forRoot({
      messages: errorMessages,
      defaultLang: 'en',
      supportedLangs: ['en', 'am'],
      // debug: process.env.NODE_ENV !== 'production',
    }),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // TypeOrmExceptionFilter replaced by LocalizedExceptionFilter below
  ],
})
export class AppModule {}
```

```ts
// apps/demo-api/src/main.ts  (swap the global filter)
import { LocalizedExceptionFilter } from '@nest-util/nest-error';

// app.useGlobalFilters(new TypeOrmExceptionFilter());   // <-- removed
app.useGlobalFilters(new LocalizedExceptionFilter());    // <-- added
```

---

## 7. Worked example: the `Post` entity

The demo-api `Post` entity (`apps/demo-api/src/app/post/post.service.ts`) extends
`NestCrudService` with `userOwnershipField: 'authorId'`, `enforceOwnership: true`, a
`statusPipeline` (draft → pending → approved/rejected → published) and an `approvalPipeline`.
Every Post error is therefore raised by the base service — the exact sites we migrate.

### 7.1 Scenario → key → generic message
| # | Post scenario | Current throw (real line) | New key | EN | AM |
|---|---|---|---|---|---|
| 1 | `GET /post/999` missing | `NotFoundException('Resource not found')` `:696` | `CRUD_RESOURCE_NOT_FOUND` | The requested resource was not found | የቀየረው ሀብት አልተገኘም |
| 2 | `GET /post/5` owned by another user (`enforceOwnership`) | `NotFoundException('Resource not found')` `:734` | `CRUD_RESOURCE_NOT_FOUND` | same (ownership hidden as 404) | — |
| 3 | No auth on owned endpoint | `ForbiddenException('Authentication required…')` `:715`/`:414` | `AUTH_UNAUTHORIZED` | Authentication is required | ማረጋገጻ ያስፈልግዎታል |
| 4 | Lacks `posts.approve` for status change | `ForbiddenException('Missing required permission…')` `:501`/`:923` | `CRUD_STATUS_TRANSITION_FORBIDDEN` | You do not have permission to change this status | ይህን ሁኔታ ለመቀየር ፍቃድ የለህም |
| 5 | `PATCH /post/1` `status: draft→published` (illegal) | `BadRequestException('Invalid status transition…')` `:485`/`:493` | `CRUD_STATUS_TRANSITION_INVALID` | The requested status change is not allowed | የተጠየቀው የሁኔታ ለውጥ አይፈቀድም |
| 6 | Create Post with bad initial `status` | `BadRequestException('Invalid initial status…')` `:451` | `CRUD_INVALID_STATUS` | The provided status is not allowed | የቀረበው ሁኔታ አይፈቀድም |
| 7 | `authorId` points to missing User | `NotFoundException('author not found')` `:217` | `CRUD_RELATION_NOT_FOUND` | The referenced related record does not exist | የተገለጸው የተዛመደ ሀብት አልተገኘም |
| 8 | Unique constraint (e.g. slug) | `TypeOrmExceptionFilter` 23505 `exception-filter.helper.ts:33` | `DB_DUPLICATE_ENTRY` | A record with this value already exists | በዚህ እሴት ሌላ መዝገብ አስቀድሞ አለ |
| 9 | DTO validation fails | `ValidationPipe` `BadRequestException` | `VALIDATION_FAILED` | Some of the provided data is invalid | የቀረቡት መረጃ አንዳንዶቹ ልክ ያልሆኑ ናቸው |
| 10 | Unhandled server error | (uncaught) | `INTERNAL_ERROR` | An unexpected error occurred. Please try again later | ያልተጠበቀ ስህተት ተከስቷል። እባክዎ ቆይተው እንደገና ይሞክሩ |

Note how the **leaky** originals (`'author not found'`, the SQL `driverError.detail`,
`'Missing required permission posts.approve'`, `'Invalid status transition draft -> published'`)
become **generic** — the developer still knows exactly what happened via the stable `code`.

### 7.2 Actual responses
`GET /api/post/999` → `Accept-Language: en`
```json
{
  "status": "error",
  "code": "CRUD_RESOURCE_NOT_FOUND",
  "message": "The requested resource was not found",
  "statusCode": 404,
  "details": null,
  "timestamp": "2026-08-14T10:00:00.000Z",
  "path": "/api/post/999"
}
```
Same request → `Accept-Language: am`
```json
{
  "status": "error",
  "code": "CRUD_RESOURCE_NOT_FOUND",
  "message": "የቀየረው ሀብት አልተገኘም",
  "statusCode": 404,
  "details": null,
  "timestamp": "2026-08-14T10:00:00.000Z",
  "path": "/api/post/999"
}
```
`PATCH /api/post/1` body `{ "status": "published" }` as a normal user (no `posts.approve`) → `am`
```json
{
  "status": "error",
  "code": "CRUD_STATUS_TRANSITION_FORBIDDEN",
  "message": "ይህን ሁኔታ ለመቀየር ፍቃድ የለህም",
  "statusCode": 403,
  "details": null,
  "path": "/api/post/1",
  "timestamp": "2026-08-14T10:00:05.000Z"
}
```
Duplicate slug → `en` (no SQL ever leaked)
```json
{
  "status": "error",
  "code": "DB_DUPLICATE_ENTRY",
  "message": "A record with this value already exists",
  "statusCode": 422,
  "details": null,
  "path": "/api/post",
  "timestamp": "2026-08-14T10:00:10.000Z"
}
```
> The real `driverError.detail` (`Key (slug)=(hello) already exists.`) is written to the **server
> log only**, never the response.

### 7.3 How the migrated throw looks (real sites)
```ts
// nest-crud.service.ts:217  (relation not found)
- throw new NotFoundException(`${String(relation.property)} not found`);
+ throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RELATION_NOT_FOUND);

// nest-crud.service.ts:485  (illegal status transition)
- throw new BadRequestException(`Invalid status transition: '${...}' -> '${...}'...`);
+ throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.CRUD_STATUS_TRANSITION_INVALID);

// nest-crud.service.ts:501  (missing transition permission)
- throw new ForbiddenException(`Missing required permission '${entry.permission}'...`);
+ throw keyed(HttpStatus.FORBIDDEN, ErrorKey.CRUD_STATUS_TRANSITION_FORBIDDEN);

// exception-filter.helper.ts:33  (duplicate entry)
- message = driverError.detail.replace('Key ', '')...   // leaked to client
+ // log driverError.detail server-side; respond with keyed 422 DB_DUPLICATE_ENTRY
```

Because `keyed()` returns a real `NotFoundException` / `BadRequestException` / `ForbiddenException`,
the existing `post.service.spec.ts` / `nest-crud.service.spec.ts` `toThrow(...)` assertions keep
passing. The `LocalizedExceptionFilter` reads `errorKey` off the exception and renders the generic,
localized JSON above.

---

## 8. Success-message localization

`nest-crud`'s `ResponseInterceptor` (`libs/nest-crud/src/lib/interceptors/response.interceptor.ts`)
injects `I18nService` (from `@nest-util/nest-error`) to localize the `@Message` value and the
entity name.

- `@Message('created')` continues to work: the stored string is treated as a **key** with a literal
  fallback (if it is not a known key, it is used as-is — backward compatible).
- Default verb keys are added to `default-messages.ts`: `MSG_CREATED`, `MSG_UPDATED`,
  `MSG_DELETED`, `MSG_FETCHED`, `MSG_REQUEST_SUCCESS`, each generic per language.
- The final success `message` is composed from a `SUCCESS_FORMAT` template
  (`"{entity} {action} successfully"`) with `{entity}` (from `@EntityName`) and `{action}` (the
  localized verb). Entity names stay as provided literals; only the verb is localized in v1.

`@nest-util/nest-error` is added as a (peer) dependency of `@nest-util/nest-crud`.

---

## 9. Migration plan (per library)

1. **`@nest-util/nest-error`** — create package; `check` (build/lint/typecheck/test) passes.
2. **demo-api** — `LocalizationModule.forRoot(...)` + sample `am` translation JSON; replace
   `useGlobalFilters(new TypeOrmExceptionFilter())` with `LocalizedExceptionFilter`.
3. **`@nest-util/nest-crud`** — migrate all `throw new XxxException('text')` in
   `nest-crud.service.ts`, `nest-crud.controller.ts` to `keyed(...)`. Update
   `exception-filter.helper.ts` (or remove it in favor of the new filter's `QueryFailedError`
   handling). Localize `ResponseInterceptor`. Update specs where they assert exact message text
   (rare — most assert on exception *type* and stay green).
4. **`@nest-util/nest-auth`** — migrate ~80 throws in `auth.service.ts`, guards, `api-key.service.ts`
   to keys (see §5.2). Keep `instanceof` test assertions valid via `keyed()`.
5. **`@nest-util/nest-notify`**, **`@nest-util/nest-payment`**, **`@nest-util/nest-file`** — migrate
   remaining throws to keys (see §5.3).
6. **Docs** — README per package; a central error-code table; config example; response shape.

### Spec-migration safety
Existing specs overwhelmingly assert on exception *type* (`toThrow(NotFoundException)`), which
remains valid because `keyed()` returns the real Nest class. A targeted `grep` for exact-message
assertions (e.g. `.toThrow('Resource not found')`) will be run; any found are updated to assert on
`errorKey` via `expect(ex.getResponse().errorKey).toBe(ErrorKey.CRUD_RESOURCE_NOT_FOUND)`.

---

## 10. Testing strategy

- `i18n.service.spec.ts` — interpolation (`{entity}`), missing-key fallback to `defaultLang`,
  unknown language falls back to `defaultLang`.
- `accept-language.resolver.spec.ts` — q-value negotiation, `supportedLangs` clamping, `x-lang`
  override when enabled.
- `localized-exception.filter.spec.ts` — keyed exception → localized generic body; non-keyed
  `HttpException` → status-based fallback key; `QueryFailedError` 23505/1062 → `DB_DUPLICATE_ENTRY`
  with **no** `detail` in response (asserted absent); unknown `Error` → `INTERNAL_ERROR`; `debug:false`
  strips `details`/`params`/`stack`.
- `keyed-error.factory.spec.ts` — `keyed(404, ...)` `instanceof NotFoundException` is `true`;
  `AppError` carries `errorKey`.
- Migration specs — ensure existing CRUD/auth specs still pass unchanged (type assertions).

---

## 11. Phasing
- **P1** — `@nest-util/nest-error` core + tests (keys, `keyed()`/`AppError`, `i18n.service`,
  `accept-language.resolver`, `localized-exception.filter`, `LocalizationModule`, `en.json`).
- **P2** — Wire demo-api; add sample `am` translation JSON; swap global filter.
- **P3** — Migrate all library throws to keys; localize `ResponseInterceptor`; retire
  `TypeOrmExceptionFilter` (or fold into new filter); update specs.
- **P4** — README + docs (config example, full key table, generic-response shape).

---

## 12. Out of scope (v1)
- Pluralization / ICU message format.
- class-validator message keying: raw validation messages pass through localized only if they
  match a key; field names are safe-listed in `details`.
- Runtime reloading of messages without restart.
- Exposing internals in non-debug mode (strictly disabled).

---

## 13. Risks / notes
- ~120 mechanical throw migrations; risk mitigated by keeping Nest exception identity (`keyed()`
  returns the real class) so `toThrow(Type)` specs stay green.
- `debug: false` (default) strictly redacts `details`/`params`/`stack` from clients; full context is
  logged server-side.
- New cross-package dependency `nest-crud → nest-error` mirrors the existing
  `nest-crud → nest-auth` peer-dependency pattern.
- `LocalizedExceptionFilter` registered as `APP_FILTER` guarantees DI for `I18nService`; the demo
  may alternatively use `useGlobalFilters(new LocalizedExceptionFilter())` with an injected instance.
