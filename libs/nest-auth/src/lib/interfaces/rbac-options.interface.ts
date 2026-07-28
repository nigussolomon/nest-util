import { ExecutionContext } from '@nestjs/common';
import { AuthUser } from './user.interface';

export interface PermissionEvaluationContext {
  user: AuthUser;
  requiredPermissions: string[];
  resolvedPermissions: string[];
  context: ExecutionContext;
}

export interface AuthRbacOptions {
  /**
   * Property on the authenticated user object that holds direct permissions.
   * @default 'permissions'
   */
  directPermissionsKey?: string;

  /**
   * Property on the authenticated user object that holds roles or user-role rows.
   * @default 'roles'
   */
  rolesKey?: string;

  /**
   * Relation on the user entity to eager load during JWT validation.
   * Example: 'roles'
   */
  userRolesRelation?: string;

  /**
   * Property on each role-like object that contains permission names.
   * @default 'permissions'
   */
  rolePermissionsKey?: string;

  /**
   * Property on a user-role row that contains the actual role object.
   * @default 'role'
   */
  nestedRoleKey?: string;

  /**
   * Whether all permissions are required. Set false to allow any match.
   * @default true
   */
  requireAllPermissions?: boolean;

  /**
   * Custom evaluator for permission checks.
   */
  permissionEvaluator?: (
    context: PermissionEvaluationContext
  ) => boolean | Promise<boolean>;

  /**
   * A permission string that grants access to all guarded routes.
   * When set, any user whose resolved permissions include this string
   * bypasses all @Permissions() checks.
   * Example: 'admin.access'
   */
  superAdminPermission?: string;
}
