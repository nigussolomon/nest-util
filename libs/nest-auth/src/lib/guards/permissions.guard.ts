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

    const hasMetadata =
      Boolean(requiredPermissions?.length) || Boolean(allowedRoles?.length);
    if (!rbac?.enabled && !hasMetadata) {
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
    const roleNameField = rbac?.roleNameField || 'name';
    const rawRoles = user[rolesField];

    if (Array.isArray(rawRoles)) {
      const roles = new Set<string>();

      rawRoles.forEach((role) => {
        if (typeof role === 'string') {
          const normalizedRole = role.trim();
          if (normalizedRole) {
            roles.add(normalizedRole);
          }
          return;
        }

        if (
          role &&
          typeof role === 'object' &&
          typeof (role as Record<string, unknown>)[roleNameField] === 'string'
        ) {
          const roleName = (
            (role as Record<string, unknown>)[roleNameField] as string
          ).trim();
          if (roleName) {
            roles.add(roleName);
          }
        }
      });

      return roles;
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
    const rolePermissionsField = rbac?.rolePermissionsField || 'permissions';
    const permissionNameField = rbac?.permissionNameField || 'key';
    const rolesField = rbac?.rolesField || 'roles';
    const directPermissions = user[permissionsField];
    const permissions = new Set<string>();
    const rawRoles = user[rolesField];

    if (Array.isArray(directPermissions)) {
      directPermissions.forEach((permission) => {
        if (typeof permission === 'string') {
          const normalizedPermission = permission.trim();
          if (normalizedPermission) {
            permissions.add(normalizedPermission);
          }
          return;
        }

        if (
          permission &&
          typeof permission === 'object' &&
          typeof (permission as Record<string, unknown>)[permissionNameField] ===
            'string'
        ) {
          const permissionName = (
            (permission as Record<string, unknown>)[permissionNameField] as string
          ).trim();
          if (permissionName) {
            permissions.add(permissionName);
          }
        }
      });
    } else if (
      typeof directPermissions === 'string' &&
      directPermissions.trim()
    ) {
      permissions.add(directPermissions.trim());
    }

    if (Array.isArray(rawRoles)) {
      rawRoles.forEach((role) => {
        if (!role || typeof role !== 'object') return;

        const rolePermissions = (role as Record<string, unknown>)[
          rolePermissionsField
        ];
        if (!Array.isArray(rolePermissions)) return;

        rolePermissions.forEach((permission) => {
          if (typeof permission === 'string') {
            const normalizedPermission = permission.trim();
            if (normalizedPermission) {
              permissions.add(normalizedPermission);
            }
            return;
          }

          if (permission && typeof permission === 'object') {
            const permissionObject = permission as Record<string, unknown>;
            const permissionName = permissionObject[permissionNameField];
            if (typeof permissionName === 'string' && permissionName.trim()) {
              permissions.add(permissionName.trim());
              return;
            }

            const resource = permissionObject.resource;
            const action = permissionObject.action;
            if (
              typeof resource === 'string' &&
              resource.trim() &&
              typeof action === 'string' &&
              action.trim()
            ) {
              permissions.add(`${resource.trim()}:${action.trim()}`);
            }
          }
        });
      });
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
