# @nest-util/nest-notify

Multi-channel notification library for NestJS: **FCM push** (Firebase Cloud Messaging) and **SMTP email** (nodemailer), with device-token persistence and per-user notification history.

## Installation

```bash
pnpm add @nest-util/nest-notify @nest-util/nest-error
```

`firebase-admin` and `nodemailer` are bundled as regular dependencies. Peer dependencies:

```bash
pnpm add @nestjs/common @nestjs/swagger @nestjs/typeorm class-validator typeorm
# Required — for JwtAuthGuard, PermissionsGuard, and @CurrentUser()
pnpm add @nest-util/nest-auth
```

`@nest-util/nest-error` is required. Register `LocalizationModule.forRoot(...)`
once for consistent error responses (see
[libs/nest-error/README.md](./../../libs/nest-error/README.md)).

## Quick Start

Register `NestNotifyModule.forRoot()` in your root module. Endpoints are available immediately — no controller class needed.

```typescript
import { NestNotifyModule } from '@nest-util/nest-notify';

@Module({
  imports: [
    AuthModule.forRoot({ /* ... */ }),   // required: guards + @CurrentUser()
    NestNotifyModule.forRoot({
      fcm: {
        enabled: true,
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      },
      smtp: {
        enabled: true,
        host: process.env.SMTP_HOST,
        port: 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: { name: 'My App', address: 'no-reply@example.com' },
      },
      controller: {
        path: 'notify',
        permissions: {
          devices: 'notify.devices',
          push: 'notify.push',
          email: 'notify.email',
          history: 'notify.history',
          mine: 'notify.mine',
        },
      },
      socket: {
        enable: true, // real-time stream for GET /notify/mine
      },
    }),
  ],
})
export class AppModule {}
```

## Configuration

### Sync

```typescript
NestNotifyModule.forRoot({
  fcm: {
    enabled: true,
    // EITHER a pre-initialized firebase-admin app:
    app: firebaseApp,
    // OR the service-account fields:
    // projectId, clientEmail, privateKey,
  },
  smtp: {
    enabled: true,
    // EITHER a pre-built nodemailer transport:
    transport: myTransport,
    // OR host/port (+ user/pass):
    // host, port, secure, user, pass, from: { name, address },
  },
  controller: {
    path: 'notify',
    permissions: {
      devices: 'notify.devices',
      push: 'notify.push',
      email: 'notify.email',
      history: 'notify.history',
    },
  },
})
```

### Async (from ConfigService)

```typescript
NestNotifyModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    fcm: {
      enabled: true,
      projectId: config.getOrThrow('FIREBASE_PROJECT_ID'),
      clientEmail: config.getOrThrow('FIREBASE_CLIENT_EMAIL'),
      privateKey: config.getOrThrow('FIREBASE_PRIVATE_KEY'),
    },
    smtp: {
      enabled: true,
      host: config.getOrThrow('SMTP_HOST'),
      port: Number(config.getOrThrow('SMTP_PORT')),
      user: config.get('SMTP_USER'),
      pass: config.get('SMTP_PASS'),
      from: { address: config.getOrThrow('SMTP_FROM') },
    },
  }),
  inject: [ConfigService],
})
```

### Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `fcm.enabled` | `boolean` | `false` | Enable push notifications |
| `fcm.app` | `App` | — | Pre-initialized `firebase-admin` App (alternative to service-account fields) |
| `fcm.projectId` | `string` | — | Firebase project ID (service account) |
| `fcm.clientEmail` | `string` | — | Service-account client email |
| `fcm.privateKey` | `string` | — | Service-account private key |
| `smtp.enabled` | `boolean` | `false` | Enable email notifications |
| `smtp.transport` | `Transporter` | — | Pre-built nodemailer transport (alternative to host/port) |
| `smtp.host` | `string` | — | SMTP host |
| `smtp.port` | `number` | — | SMTP port |
| `smtp.secure` | `boolean` | `false` | Use TLS (port 465) |
| `smtp.user` | `string` | — | SMTP username |
| `smtp.pass` | `string` | — | SMTP password |
| `smtp.from` | `{ name?, address }` | — | Default sender (required when SMTP enabled via host/port) |
| `controller.enable` | `boolean` | `true` | Auto-register controller |
| `controller.path` | `string` | `'notify'` | Controller route path |
| `controller.permissions` | `object` | — | RBAC permissions per endpoint |
| `socket.enable` | `boolean` | `false` | Enable the Socket.IO notifications gateway |
| `socket.namespace` | `string` | `'/notify'` | Socket.IO namespace |
| `socket.path` | `string` | `'/socket.io'` | Socket.IO path |
| `socket.cors` | `object` | `{ origin: true }` | Socket.IO CORS options (`origin`, `credentials`, `methods`) |
| `socket.tokenQueryParam` | `string` | `'token'` | Handshake field carrying the JWT (checked in `auth` then `query`) |
| `socket.authorize` | `(token) => Promise<{ userId } \| null>` | — | Custom handshake authenticator (overrides default JWT auth) |

### Guardrails

- `fcm.enabled: true` throws at construction unless `fcm.app` OR (`fcm.projectId` + `fcm.clientEmail` + `fcm.privateKey`) is provided.
- `smtp.enabled: true` throws at construction unless `smtp.transport` OR (`smtp.host` + `smtp.port` + `smtp.from.address`) is provided.

## Real-Time Notifications (WebSocket)

When `socket.enable: true`, the module registers a Socket.IO gateway that **auto-streams new notifications** to the authenticated user — so `GET /notify/mine` no longer needs to be polled for updates. The gateway requires `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/jwt` and `socket.io`:

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io @nestjs/jwt socket.io
```

Client connects to the `/notify` namespace, authenticating with the same access token used for the REST API (in `auth.token`, `query.token`, or the `Authorization: Bearer` header):

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/notify', {
  auth: { token: accessToken },
});

// New notification for the current user (mirrors /notify/mine rows)
socket.on('notification:created', (notification) => {
  // prepend to the mine feed
});

socket.on('error', ({ message }) => {
  // e.g. Unauthorized — re-auth and reconnect
});
```

Key behaviors:

- Authentication reuses the JWT machinery from `@nest-util/nest-auth` (`JwtService` + `AuthService.validateUser`, including the nonce check). A custom `socket.authorize(token)` callback can be supplied instead — required when `nest-auth` is not installed.
- Each authenticated connection joins a `notify:{userId}` room. When `push(userId, ...)` or `email(payload, userId)` persists a notification, the saved row is emitted to that room as `notification:created` (event name exported as `NOTIFICATION_CREATED_EVENT`). Token-only sends (`pushToToken`) have no recipient and are not streamed.
- Unauthorized or disabled connections receive an `error` event and are disconnected.
- Offline backlog is still read via `GET /notify/mine` (or `getNotifications`) — the socket only adds live updates.
- `forRootAsync`: the gateway is always registered and reads `socket.enable` / `tokenQueryParam` / `authorize` from the resolved options at runtime; namespace/path/CORS use defaults.
- The gateway is injectable via the exported `NOTIFY_GATEWAY` token (`emitToUser(userId, event, payload)`) for emitting custom events to a user's sockets.

## Endpoints

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/notify/devices` | `devices` | Register an FCM device token `{ token, platform, deviceId? }` |
| `GET` | `/notify/devices` | `devices` | List the current user's device tokens |
| `DELETE` | `/notify/devices` | `devices` | Unregister a device token |
| `POST` | `/notify/push` | `push` | Send a push `{ title, body, userId?, imageUrl?, clickAction?, data? }` |
| `POST` | `/notify/email` | `email` | Send an email `{ to, subject, text?, html?, cc?, bcc?, replyTo?, userId? }` |
| `GET` | `/notify/history` | `history` | Query notification history `{ channel?, page?, limit? }` (scoped to current user) |
| `GET` | `/notify/mine` | `mine` | List the current user's notifications `{ channel?, page?, limit? }` |

All endpoints are guarded with `JwtAuthGuard` + `PermissionsGuard`. `push` and `email` default to the authenticated user when `userId` is omitted.

## NotifyService

| Method | Description |
|---|---|
| `registerDeviceToken(userId, token, platform, deviceId?)` | Upsert a device token for a user |
| `unregisterDeviceToken(userId, token)` | Delete a user's device token |
| `listDeviceTokens(userId)` | List a user's device tokens |
| `push(userId, payload)` | Send a push to all of a user's tokens; records history; prunes dead tokens |
| `pushToToken(token, payload)` | Fire-and-forget push to a single token |
| `email(payload, userId?)` | Send an email; records history |
| `getNotifications({ userId, channel?, page?, limit? })` | Paginated notification history |

`push` returns `{ successCount, failureCount, results: [{ token, success, code? }] }`. FCM messages are sent in batches of 500.

## Dead-Token Pruning

After a batch send, responses carrying dead-token codes are collected and removed from the `device_tokens` table:

- `messaging/registration-token-not-registered`
- `messaging/invalid-registration-token`
- `messaging/invalid-argument`
- `messaging/mismatched-credential`

## Entities

### DeviceTokenEntity (`device_tokens`)

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary key |
| `userId` | `string` | Owner user ID (indexed) |
| `token` | `string` | FCM registration token (unique) |
| `platform` | `'android' \| 'ios' \| 'web'` | Device platform |
| `deviceId` | `string?` | Client-generated device identifier |
| `lastUsedAt` | `Date?` | Last successful delivery |
| `createdAt` / `updatedAt` | `Date` | Timestamps |

### NotificationEntity (`notifications`)

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary key |
| `userId` | `string?` | Recipient user ID (indexed) |
| `channel` | `'push' \| 'email'` | Notification channel |
| `provider` | `'fcm' \| 'smtp'` | Underlying provider |
| `status` | `'sent' \| 'failed'` | Delivery outcome |
| `title` | `string?` | Push title / email subject |
| `body` | `text?` | Push body / email text summary |
| `subject` | `string?` | Email subject |
| `to` | `string?` | Email recipient or device token |
| `error` | `text?` | Error message on failure |
| `metadata` | `jsonb?` | Arbitrary metadata |
| `sentAt` | `Date` | When the send was attempted |

## Custom Controller

Disable the auto-registered controller and use `CreateNotifyController()` for custom routing:

```typescript
NestNotifyModule.forRoot({
  fcm: { /* ... */ },
  smtp: { /* ... */ },
  controller: { enable: false },
});
```

```typescript
import { Controller } from '@nestjs/common';
import { CreateNotifyController } from '@nest-util/nest-notify';

const NotifyBase = CreateNotifyController({
  permissions: {
    devices: 'notify.devices',
    push: 'notify.push',
    email: 'notify.email',
    history: 'notify.history',
    mine: 'notify.mine',
  },
});

@Controller('custom-notify')
export class NotifyController extends NotifyBase {
  constructor(override readonly notifyService: NotifyService) {
    super(notifyService);
  }
}
```

## Building

Run `nx build nest-notify` to build the library.

## Running unit tests

Run `nx test nest-notify` to execute the unit tests via [Jest](https://jestjs.io).
