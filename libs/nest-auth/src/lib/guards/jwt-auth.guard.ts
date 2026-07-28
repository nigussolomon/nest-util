import {
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { Observable } from 'rxjs';
import { ApiKeyService } from '../services/api-key.service';

const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Optional() @Inject(EventEmitter2) private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly apiKeyService?: ApiKeyService
  ) {
    super();
  }

  override canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers[API_KEY_HEADER];

    if (apiKey && this.apiKeyService) {
      return this.validateApiKey(context, apiKey);
    }

    return super.canActivate(context);
  }

  private async validateApiKey(
    context: ExecutionContext,
    apiKey: string
  ): Promise<boolean> {
    try {
      const { user } = await this.apiKeyService!.validate(apiKey);
      const request = context.switchToHttp().getRequest();
      request.user = user;
      return true;
    } catch (error) {
      const reason =
        error instanceof UnauthorizedException
          ? error.message
          : 'API key validation failed';

      if (this.eventEmitter) {
        this.eventEmitter.emit('auth.api-key.denied', {
          action: 'auth.api-key.denied',
          entity: 'auth',
          timestamp: new Date(),
          metadata: { reason },
        });
      }

      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException(reason);
    }
  }

  override handleRequest<TUser = Record<string, unknown>>(
    err: unknown,
    user: TUser
  ): TUser {
    if (user) {
      return user;
    }

    if (this.eventEmitter) {
      this.eventEmitter.emit('auth.jwt.denied', {
        action: 'auth.jwt.denied',
        entity: 'auth',
        timestamp: new Date(),
        metadata: { reason: err instanceof Error ? err.message : 'Unauthorized' },
      });
    }

    if (err instanceof UnauthorizedException) {
      throw err;
    }

    if (err instanceof HttpException && err.getStatus() === 401) {
      throw err;
    }

    throw new UnauthorizedException();
  }
}
