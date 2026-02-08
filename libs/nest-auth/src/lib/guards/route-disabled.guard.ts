import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';

@Injectable()
export class RouteDisabledGuard implements CanActivate {
  constructor(
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const route = request.route.path.split('/').pop(); // Simple check for 'login' or 'register'

    if (this.options.disabledRoutes?.includes(route)) {
      throw new ForbiddenException(`Route ${request.route.path} is disabled`);
    }

    return true;
  }
}
