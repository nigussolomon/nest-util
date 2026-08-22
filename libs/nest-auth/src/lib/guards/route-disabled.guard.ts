import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  HttpStatus,
} from '@nestjs/common';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { keyed, ErrorKey } from '@nest-util/nest-error';

@Injectable()
export class RouteDisabledGuard implements CanActivate {
  constructor(
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const route = request.route.path.split('/').pop(); // Simple check for 'login' or 'register'

    if (this.options.disabledRoutes?.includes(route)) {
      throw keyed(HttpStatus.FORBIDDEN, ErrorKey.AUTH_ROUTE_DISABLED);
    }

    return true;
  }
}
