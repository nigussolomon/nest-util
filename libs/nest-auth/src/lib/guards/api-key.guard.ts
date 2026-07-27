import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiKeyService } from '../services/api-key.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';

const DEFAULT_HEADER_NAME = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly headerName: string;

  constructor(
    private readonly apiKeyService: ApiKeyService,
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
    @Optional() @Inject(EventEmitter2) private readonly eventEmitter?: EventEmitter2
  ) {
    this.headerName =
      this.options.apiKey?.headerName ?? DEFAULT_HEADER_NAME;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers[this.headerName];

    if (!apiKey) {
      return true;
    }

    try {
      const { user, apiKey: apiKeyEntity } =
        await this.apiKeyService.validate(apiKey);
      request.user = user;
      request.apiKey = apiKeyEntity;

      this.emit('auth.api-key.used', {
        userId: user.id,
        apiKeyId: apiKeyEntity.id,
      });

      return true;
    } catch (error) {
      const reason =
        error instanceof UnauthorizedException
          ? error.message
          : 'API key validation failed';

      this.emit('auth.api-key.denied', {
        metadata: { reason },
      });

      throw error;
    }
  }

  private emit(action: string, data: Record<string, unknown>): void {
    if (!this.eventEmitter) return;
    this.eventEmitter.emit(action, {
      action,
      entity: 'auth',
      timestamp: new Date(),
      ...data,
    });
  }
}
