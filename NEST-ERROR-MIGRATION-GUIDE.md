# Nest Error Migration Guide

This guide explains the **standardized error system** introduced via the new
`@nest-util/nest-error` package and what **consumer projects** must do when they
upgrade `@nest-util/nest-crud`, `@nest-util/nest-auth`, `@nest-util/nest-notify`,
`@nest-util/nest-payment`, or `@nest-util/nest-file` to a release that depends on
it.

The change is **opt-in at the rendering layer but required at the dependency layer**:
every error thrown by these libraries now carries a stable `errorKey`, and a single
catch-all `LocalizedExceptionFilter` turns it into a consistent, localized, generic
JSON body. The hard requirement is installing the new peer package; adopting the
filter is strongly recommended to avoid a changed error-body shape.

---

## TL;DR

1. `pnpm add @nest-util/nest-error` — **required** (new peer dependency).
2. Register `LocalizationModule.forRoot(...)` once in your root module — **recommended**.
3. Update client code that reads `response.body.error` (removed) or expects `message` to be a plain string.

If you only do (1) and skip (2), your API still works but error `message` fields
become **objects** instead of strings (see [What Breaks](#what-breaks) below).

---

## Why this changed

- **Stable, machine-readable codes.** Every error now has an `errorKey`
  (e.g. `AUTH_USER_NOT_FOUND`, `CRUD_RESOURCE_NOT_FOUND`) so clients can branch on
  a code instead of parsing English strings.
- **Localization.** Messages come from a message map and can be translated per
  language (`Accept-Language` / `x-lang`).
- **No leakage.** SQL, stack traces, and raw user input are never sent to the
  client. TypeORM unique-violation errors (`23505` / errno `1062`) map to a generic
  `DB_DUPLICATE_ENTRY` (HTTP 422) with no SQL exposed.
- **Backward-compatible throwing.** `keyed(status, code, ...)` returns the **real**
  NestJS exception class (`NotFoundException`, `BadRequestException`, …), so existing
  `expect(...).rejects.toThrow(NotFoundException)` tests and `instanceof` checks keep
  working.

---

## What Breaks

### 1. New required peer dependency (hard break)

`@nest-util/nest-error` is a **required** `peerDependency` of the five libraries.
Library source imports it at load time, so failing to install it crashes the app:

```
Cannot find module '@nest-util/nest-error'
```

**Fix:** add it to your dependencies (see [Step 1](#step-1-install-the-peer)).

### 2. Error response body shape changed

Historically these libraries threw plain `new HttpException('msg')`, so you got the
default Nest body:

```json
{ "statusCode": 404, "message": "Resource not found", "error": "Not Found" }
```

After the migration, two outcomes are possible depending on whether you register
the filter:

#### A. You do NOT register `LocalizationModule.forRoot()`

The library throws `keyed(...)`, which embeds the `errorKey` in the response object.
The default Nest filter then serializes that object as `message`:

```json
{
  "statusCode": 404,
  "message": {
    "errorKey": "CRUD_RESOURCE_NOT_FOUND",
    "params": null,
    "details": null,
    "message": "The requested resource was not found"
  },
  "error": "Not Found"
}
```

➡️ **Breaking:** `response.body.message` is now an **object**, not a string.

#### B. You DO register `LocalizationModule.forRoot()`

You get the standardized body (the `error` field is **removed**, new fields added):

```json
{
  "status": "error",
  "code": "CRUD_RESOURCE_NOT_FOUND",
  "message": "The requested resource was not found",
  "statusCode": 404,
  "details": null,
  "timestamp": "2026-08-22T12:00:00.000Z",
  "path": "/posts/42"
}
```

➡️ **Breaking:** clients reading `body.error` must switch to `body.code` /
`body.errorKey`. `body.message` is again a localized **string**.

### 3. English wording changed (soft break)

Even with the filter, the English text differs from before because messages now come
from the library's generic defaults keyed by `errorKey`
(e.g. `'Resource not found'` → `'The requested resource was not found'`). Clients
that assert on exact message strings will need updating.

### Non-breaking (preserved)

- `statusCode` is unchanged.
- `instanceof NotFoundException` / `catch` / `toThrow(NotFoundException)` still work.
- `ResponseInterceptor` only gained `@Optional()` injected `I18nService` /
  `LangResolverService`; Nest-managed instantiation is unaffected.

---

## Step 1: Install the peer

```bash
pnpm add @nest-util/nest-error
```

Add it to `package.json`:

```json
{
  "dependencies": {
    "@nest-util/nest-error": "^1.0.0"
  }
}
```

> The package is a workspace package today; once published, pin to the released
> version range.

## Step 2: Register `LocalizationModule` (recommended)

Register it **once**, globally, in your root module. It wires the `I18nService`,
`LangResolverService`, and the global `LocalizedExceptionFilter` (`APP_FILTER`).

```typescript
import { LocalizationModule } from '@nest-util/nest-error';
import errorMessages from './config/error-messages.json';

@Module({
  imports: [
    LocalizationModule.forRoot({
      messages: errorMessages,        // { [lang]: { [errorKey]: 'template' } }
      defaultLang: 'en',
      supportedLangs: ['en'],
      debug: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

`error-messages.json` (deep-merged over the library defaults, so you only override
what you need):

```json
{
  "en": {
    "AUTH_USER_NOT_FOUND": "The requested user was not found",
    "CRUD_RESOURCE_NOT_FOUND": "The requested resource was not found"
  }
}
```

Language is resolved from `Accept-Language` (clamped to `supportedLangs`), or from
`x-lang` when `allowHeaderOverride: true`.

## Step 3: Update client error handling

| Before | After (with filter) |
|---|---|
| `body.error` (`"Not Found"`) | `body.code` / `body.errorKey` |
| `body.message` is a string | `body.message` is a localized string |
| switch on message text | switch on `body.code` |

Example client check:

```typescript
if (err.response?.code === 'AUTH_USER_NOT_FOUND') { /* ... */ }
```

## Step 4: Replace the old `TypeOrmExceptionFilter`

Previously you may have registered the library's `TypeOrmExceptionFilter` globally to
turn duplicate-key errors (`23505`) into clean responses:

```typescript
// main.ts — no longer needed
app.useGlobalFilters(new TypeOrmExceptionFilter());
```

The new `LocalizedExceptionFilter` (registered by `LocalizationModule.forRoot`)
**already** maps TypeORM `QueryFailedError` unique violations to `DB_DUPLICATE_ENTRY`
(HTTP 422) with no SQL leaked. Remove the manual `useGlobalFilters` call.

## Step 5: Localizing / overriding messages

Add or override any `errorKey` in your `error-messages.json`. Templates support
`{placeholder}` interpolation from the `params` passed to `keyed()`:

```json
{
  "en": { "AUTH_PASSWORD_WEAK": "Your password must be at least {minLength} characters" }
}
```

```typescript
throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.AUTH_PASSWORD_WEAK, { minLength: 8 });
```

`details` (and `params` / stack) are only sent to the client when `debug: true`.

---

## Troubleshooting

### `Cannot find module '@nest-util/nest-error'`
You upgraded a library that now requires the peer. Run `pnpm add @nest-util/nest-error`.

### My error `message` is an object, not a string
You installed the peer (step 1) but did **not** register `LocalizationModule.forRoot`
(step 2). Either register it, or (as a temporary measure) read
`response.body.message.message` until you migrate your clients.

### `body.error` is undefined after upgrading
The standardized body uses `code` / `errorKey`, not `error`. Update clients
(see Step 3).

### My tests assert on exact English messages
Update them to assert on `errorKey` (`body.code`) or the new wording. The library
throws the real NestJS exception, so `toThrow(NotFoundException)` still passes.

---

## Rollback

The dependency is required, so you cannot fully remove `@nest-util/nest-error` while
on a release that depends on it. If you must delay adopting the filter, install the
peer and keep your own global exception filter — but note the `message`-as-object
shape until you switch to `LocalizationModule`.

See also the main [Migration Guide](./MIGRATION-GUIDE.md) (Phase 17).
