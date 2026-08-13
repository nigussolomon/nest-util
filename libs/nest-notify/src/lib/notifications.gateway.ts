import {
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
  type Type,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '@nest-util/nest-auth';
import { NOTIFY_OPTIONS } from './constants';
import type { NestNotifyOptions } from './interfaces/nest-notify-options.interface';

/** Minimal interface implemented by the gateway and consumed by `NotifyService`. */
export interface NotificationsGateway {
  /** Emit an event to every socket currently connected for `userId`. */
  emitToUser(userId: string, event: string, payload: unknown): void;
}

interface SocketGatewayConfig {
  namespace: string;
  path: string;
  cors: Record<string, unknown>;
}

function resolveGatewayConfig(options: NestNotifyOptions): SocketGatewayConfig {
  const socket = options.socket ?? {};
  return {
    namespace: socket.namespace ?? '/notify',
    path: socket.path ?? '/socket.io',
    cors: socket.cors ?? { origin: true },
  };
}

/**
 * Build a Socket.IO gateway for the notifications module.
 *
 * Authenticated connections are placed in a `notify:{userId}` room that
 * `NotifyService` streams new notifications into. Auth uses the JWT from the
 * socket handshake (reusing `JwtService` + `AuthService` from
 * `@nest-util/nest-auth`), or a custom `socket.authorize` callback.
 *
 * Namespace/path/CORS come from `options.socket` when registered synchronously
 * via `forRoot`; for `forRootAsync` the runtime `enable`/`tokenQueryParam`/
 * `authorize` values are read from `NOTIFY_OPTIONS` (decorator-level values fall
 * back to defaults).
 */
export function createNotifyGateway(
  options: NestNotifyOptions
): Type<NotificationsGateway> {
  const { namespace, path, cors } = resolveGatewayConfig(options);

  @Injectable()
  @WebSocketGateway({
    namespace,
    path,
    cors,
    transports: ['websocket', 'polling'],
  })
  class NotificationsGatewayBase
    implements
      OnGatewayConnection,
      OnGatewayDisconnect,
      NotificationsGateway
  {
    private readonly logger = new Logger('NotificationsGateway');

    @WebSocketServer()
    server?: Server;

    constructor(
      @Inject(NOTIFY_OPTIONS) private readonly notifyOptions: NestNotifyOptions,
      @Optional() @Inject(JwtService) private readonly jwtService?: JwtService,
      @Optional() @Inject(AuthService) private readonly authService?: AuthService
    ) {}

    async handleConnection(client: Socket): Promise<void> {
      try {
        const socket = this.notifyOptions.socket;
        if (socket?.enable !== true) {
          throw new UnauthorizedException('Notifications socket is disabled');
        }
        const token = this.extractToken(client, socket.tokenQueryParam);
        if (!token) {
          throw new UnauthorizedException('Missing authentication token');
        }
        const userId = await this.resolveUserId(token, socket.authorize);
        client.data.userId = userId;
        await client.join(this.room(userId));
        this.logger.log(`Notification socket connected for user ${userId}`);
      } catch (error) {
        this.logger.warn(
          `Notification socket rejected: ${(error as Error).message}`
        );
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
      }
    }

    handleDisconnect(client: Socket): void {
      const userId = client.data?.userId as string | undefined;
      if (userId) {
        this.logger.log(`Notification socket disconnected for user ${userId}`);
      }
    }

    emitToUser(userId: string, event: string, payload: unknown): void {
      this.server?.to(this.room(userId)).emit(event, payload);
    }

    private extractToken(
      client: Socket,
      tokenQueryParam?: string
    ): string | undefined {
      const param = tokenQueryParam ?? 'token';
      const fromAuth = client.handshake?.auth?.[param];
      if (fromAuth) {
        return String(fromAuth);
      }
      const fromQuery = client.handshake?.query?.[param];
      if (fromQuery) {
        return String(fromQuery);
      }
      const header = client.handshake?.headers?.authorization;
      if (header) {
        const match = /^Bearer\s+(.+)$/i.exec(header);
        if (match) {
          return match[1];
        }
      }
      return undefined;
    }

    private async resolveUserId(
      token: string,
      authorize?: (token: string) => Promise<{ userId: string } | null>
    ): Promise<string> {
      if (authorize) {
        const result = await authorize(token);
        if (!result) {
          throw new UnauthorizedException('Invalid token');
        }
        return result.userId;
      }
      if (!this.jwtService || !this.authService) {
        throw new UnauthorizedException(
          'Socket authentication requires @nest-util/nest-auth or a custom socket.authorize handler'
        );
      }
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.authService.validateUser({
        sub: payload.sub,
        nonce: payload.nonce,
      });
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }
      return String(payload.sub);
    }

    private room(userId: string): string {
      return `notify:${userId}`;
    }
  }

  return NotificationsGatewayBase;
}
