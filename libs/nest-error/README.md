# @nest-util/nest-error

Standardized, localized, **generic** error system for NestJS services in the
`nest-util` ecosystem (`nest-crud`, `nest-auth`, `nest-notify`, `nest-payment`,
`nest-file`).

Every error is rendered through a single catch-all `LocalizedExceptionFilter`
as a consistent JSON body driven by a stable `errorKey`, a translatable
message, and a `statusCode` — never leaking SQL, stack traces, or raw
user input to the client.

## Features

- `keyed(status, code, params?, safeDetails?)` — throw a real NestJS exception
  class (`NotFoundException`, `BadRequestException`, …) that carries a stable
  `errorKey` so existing `expect(...).rejects.toThrow(NotFoundException)` tests
  keep passing.
- `ErrorKey` enum — the single source of truth for all error codes.
- `LocalizedExceptionFilter` — catch-all filter that localizes keyed errors,
  maps TypeORM `QueryFailedError` (unique violations) to `DB_DUPLICATE_ENTRY`,
  and converts unknown errors to `INTERNAL_ERROR`.
- `LocalizationModule.forRoot(options)` — global module that wires the i18n
  service, language resolver, and the filter (`APP_FILTER`).
- `I18nService` — translate an `errorKey` with `{placeholder}` interpolation.
- Security-first: `params`/`details`/stack are stripped from the response
  unless `debug` is enabled.

## Installation

```bash
pnpm add @nest-util/nest-error
```

## Quick start

Register the module once, globally, in your root module:

```typescript
import { LocalizationModule } from '@nest-util/nest-error';
import errorMessages from './config/error-messages.json';

@Module({
  imports: [
    LocalizationModule.forRoot({
      messages: errorMessages, // { [lang]: { [errorKey]: 'template' } }
      defaultLang: 'en',
      supportedLangs: ['en', 'am'],
      debug: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

Language is resolved from the `Accept-Language` header (clamped to
`supportedLangs`), or from the `x-lang` header when `allowHeaderOverride` is
`true`.

## Throwing errors

Use `keyed()` instead of `new HttpException(...)`. It returns the matching
native NestJS class, so the HTTP status and exception type are unchanged:

```typescript
import { keyed, ErrorKey, HttpStatus } from '@nest-util/nest-error';

if (!user) {
  throw keyed(HttpStatus.NOT_FOUND, ErrorKey.AUTH_USER_NOT_FOUND);
}

throw keyed(
  HttpStatus.BAD_REQUEST,
  ErrorKey.AUTH_PASSWORD_WEAK,
  { minLength: 8 },            // interpolated into the message (safe values only)
  { attemptId: '...' },        // redacted from the client unless debug
);
```

`params` are string-interpolated into the translated message
(`"Your password must be at least {minLength} characters"`). `safeDetails` are
never sent to the client unless `debug` is enabled, and must **never** contain
user input or secrets.

### Custom app errors

```typescript
import { AppError, ErrorKey, HttpStatus } from '@nest-util/nest-error';

throw new AppError(HttpStatus.CONFLICT, ErrorKey.AUTH_ROLE_ALREADY_EXISTS);
```

## Response body

```json
{
  "status": "error",
  "code": "AUTH_USER_NOT_FOUND",
  "message": "The requested user was not found",
  "statusCode": 404,
  "details": null,
  "timestamp": "2026-08-22T12:00:00.000Z",
  "path": "/users/42"
}
```

- `code` — the stable `ErrorKey` (e.g. `AUTH_USER_NOT_FOUND`).
- `message` — the localized, generic message for `code`.
- `details` — populated **only** when `debug` is enabled.
- Non-keyed `HttpException`s still get a generic `code`
  (`VALIDATION_FAILED`, `NOT_FOUND`, `AUTH_UNAUTHORIZED`, `AUTH_PERMISSION_DENIED`,
  `INTERNAL_ERROR`) while preserving their original message.
- TypeORM `QueryFailedError` unique violations map to `DB_DUPLICATE_ENTRY`
  (HTTP 422) with no SQL leaked; other DB errors map to `DB_QUERY_FAILED`.

## Localization

`LocalizationModule.forRoot({ messages })` deep-merges your JSON over the
library's built-in `defaultMessages`, so you only override what you need.

`error-messages.json`:

```json
{
  "en": {
    "AUTH_USER_NOT_FOUND": "The requested user was not found",
    "AUTH_PASSWORD_WEAK": "Your password must be at least {minLength} characters"
  },
  "am": {
    "AUTH_USER_NOT_FOUND": "መጠቀሚያው አልተገኘም",
    "AUTH_PASSWORD_WEAK": "የይለፍ ቃልዎ ቢያንም {minLength} ፊደላት ሊሆን አለበት"
  }
}
```

Missing keys fall back to `defaultLang` (configurable via `fallbackToDefault`).

## Adding new error keys

1. Add the key to `libs/nest-error/src/lib/constants/error-keys.ts`
   (`ErrorKey` enum).
2. Add the English default to `default-messages.ts` (and optionally
   `en.json` for reference).
3. Add translations in your app's `error-messages.json`.
4. Throw with `keyed(HttpStatus.X, ErrorKey.YOUR_KEY)`.

## Using the services directly

```typescript
import { I18nService, LangResolverService } from '@nest-util/nest-error';

constructor(
  private readonly i18n: I18nService,
  private readonly langs: LangResolverService,
) {}

const msg = this.i18n.translate(ErrorKey.AUTH_USER_NOT_FOUND, undefined, 'am');
const lang = this.langs.resolve(request);
```

## Migrating existing throws

Replace `throw new BadRequestException('msg')` with
`throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.SOME_KEY)`. The HTTP status and
exception class are preserved, so existing `toThrow(...)` assertions keep
working. Prefer a specific `ErrorKey` over a generic one; reuse existing keys
where the semantics match before adding new ones.
