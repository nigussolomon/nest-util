import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_OPTIONS } from '../constants';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { PERMISSIONS_KEY } from '../decorators/permissions';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { AuthUser } from '../interfaces/user.interface';
import { resolvePermissions } from '../helpers/permission.helper';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authenticated user not found');
    }

    const resolvedPermissions = resolvePermissions(user, this.options.rbac);

    if (this.options.rbac?.permissionEvaluator) {
      const isAllowed = await this.options.rbac.permissionEvaluator({
        user,
        requiredPermissions,
        resolvedPermissions,
        context,
      });

      if (!isAllowed) {
        throw new ForbiddenException('Missing required permissions');
      }

      return true;
    }

    const requireAllPermissions =
      this.options.rbac?.requireAllPermissions ?? true;
    const isAllowed = requireAllPermissions
      ? requiredPermissions.every((permission) =>
          resolvedPermissions.includes(permission)
        )
      : requiredPermissions.some((permission) =>
          resolvedPermissions.includes(permission)
        );

    if (!isAllowed) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
