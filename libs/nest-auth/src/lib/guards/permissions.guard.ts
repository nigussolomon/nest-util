import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ALLOWED_ROLES_KEY,
  ALLOW_ANY_PERMISSION_KEY,
  AUTH_OPTIONS,
  REQUIRED_PERMISSIONS_KEY,
} from '../constants';
import type { AuthModuleOptions, RbacOptions } from '../interfaces/auth-options';
import { IS_PUBLIC_KEY } from '../decorators/public';

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

    const user = context.switchToHttp().getRequest()?.user as
      | Record<string, unknown>
      | undefined;
    if (!user) {
      throw new UnauthorizedException();
    }

    const rbac = this.options.rbac;
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );
    const allowedRoles = this.reflector.getAllAndOverride<string[]>(
      ALLOWED_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );
    const allowAnyPermission = this.reflector.getAllAndOverride<boolean>(
      ALLOW_ANY_PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (allowAnyPermission) {
      return true;
    }

    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!allowedRoles || allowedRoles.length === 0) &&
      !rbac?.enabled
    ) {
      return true;
    }

    const userRoles = this.getUserRoles(user, rbac);
    const userPermissions = await this.getUserPermissions(user, userRoles, rbac);

    if (allowedRoles?.some((role) => userRoles.has(role))) {
      return true;
    }

    if (requiredPermissions?.length) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.has(permission)
      );
      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `Missing required permissions: ${missingPermissions.join(', ')}`
        );
      }
      return true;
    }

    const denyByDefault = rbac?.denyByDefault ?? Boolean(rbac?.enabled);
    if (denyByDefault) {
      throw new ForbiddenException(
        'Access denied: route has no explicit RBAC metadata'
      );
    }

    return true;
  }

  private getUserRoles(
    user: Record<string, unknown>,
    rbac?: RbacOptions
  ): Set<string> {
    const rolesField = rbac?.rolesField || 'roles';
    const rawRoles = user[rolesField];

    if (Array.isArray(rawRoles)) {
      return new Set(
        rawRoles
          .filter((role): role is string => typeof role === 'string')
          .map((role) => role.trim())
          .filter(Boolean)
      );
    }

    if (typeof rawRoles === 'string' && rawRoles.trim()) {
      return new Set([rawRoles.trim()]);
    }

    return new Set<string>();
  }

  private async getUserPermissions(
    user: Record<string, unknown>,
    userRoles: Set<string>,
    rbac?: RbacOptions
  ): Promise<Set<string>> {
    const permissionsField = rbac?.permissionsField || 'permissions';
    const directPermissions = user[permissionsField];
    const permissions = new Set<string>();

    if (Array.isArray(directPermissions)) {
      directPermissions
        .filter(
          (permission): permission is string => typeof permission === 'string'
        )
        .forEach((permission) => permissions.add(permission));
    } else if (
      typeof directPermissions === 'string' &&
      directPermissions.trim().length > 0
    ) {
      permissions.add(directPermissions.trim());
    }

    const rolePermissions = rbac?.rolePermissions ?? {};
    userRoles.forEach((role) => {
      (rolePermissions[role] ?? []).forEach((permission) =>
        permissions.add(permission)
      );
    });

    if (rbac?.resolvePermissions) {
      const resolvedPermissions = await rbac.resolvePermissions(user);
      resolvedPermissions.forEach((permission) => permissions.add(permission));
    }

    return permissions;
  }
}
