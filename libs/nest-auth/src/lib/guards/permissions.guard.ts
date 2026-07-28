import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
    @Optional() @Inject(EventEmitter2) private readonly eventEmitter?: EventEmitter2
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
      this.emitDenied('auth.permissions.denied', {
        userId: undefined,
        metadata: {
          requiredPermissions,
          userPermissions: [],
          reason: 'Authenticated user not found',
        },
      });
      throw new ForbiddenException('Authenticated user not found');
    }

    const resolvedPermissions = resolvePermissions(user, this.options.rbac);

    const superAdmin = this.options.rbac?.superAdminPermission;
    if (superAdmin && resolvedPermissions.includes(superAdmin)) {
      return true;
    }

    if (this.options.rbac?.permissionEvaluator) {
      const isAllowed = await this.options.rbac.permissionEvaluator({
        user,
        requiredPermissions,
        resolvedPermissions,
        context,
      });

      if (!isAllowed) {
        this.emitDenied('auth.permissions.denied', {
          userId: user.id,
          metadata: {
            requiredPermissions,
            userPermissions: resolvedPermissions,
            evaluateMode: 'custom',
            reason: 'Custom evaluator rejected',
          },
        });
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
      this.emitDenied('auth.permissions.denied', {
        userId: user.id,
        metadata: {
          requiredPermissions,
          userPermissions: resolvedPermissions,
          evaluateMode: requireAllPermissions ? 'all' : 'any',
          reason: 'Missing required permissions',
        },
      });
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }

  private emitDenied(action: string, data: Record<string, unknown>): void {
    if (!this.eventEmitter) return;
    this.eventEmitter.emit(action, {
      action,
      entity: 'auth',
      timestamp: new Date(),
      ...data,
    });
  }
}
