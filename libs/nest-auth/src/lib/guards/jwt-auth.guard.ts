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

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Optional() @Inject(EventEmitter2) private readonly eventEmitter?: EventEmitter2
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
    return super.canActivate(context);
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
