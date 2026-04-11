import { Type } from '@nestjs/common';

export interface RbacOptions {
  /**
   * Enable RBAC evaluation in PermissionsGuard.
   * @default false
   */
  enabled?: boolean;

  /**
   * User object field containing assigned roles.
   * @default 'roles'
   */
  rolesField?: string;

  /**
   * Role object field containing role name.
   * Used when rolesField points to an array of role objects.
   * @default 'name'
   */
  roleNameField?: string;

  /**
   * Role object field containing role permissions.
   * @default 'permissions'
   */
  rolePermissionsField?: string;

  /**
   * User object field containing directly assigned permissions.
   * @default 'permissions'
   */
  permissionsField?: string;

  /**
   * Permission object field containing permission key (e.g. "users:read").
   * @default 'key'
   */
  permissionNameField?: string;

  /**
   * Static role to permissions map.
   */
  rolePermissions?: Record<string, string[]>;

  /**
   * Optional custom permissions resolver.
   */
  resolvePermissions?: (
    user: Record<string, unknown>
  ) => string[] | Promise<string[]>;

  /**
   * Deny access for protected routes without permission metadata.
   * Defaults to true when RBAC is enabled, false otherwise.
   */
  denyByDefault?: boolean;
}

export interface AuthModuleOptions {
  /**
   * The TypeORM entity for users.
   */
  userEntity: Type<unknown>;

  /**
   * Field to use for login (e.g., 'email', 'username').
   * @default 'email'
   */
  identifierField: string;

  /**
   * Field for password (e.g., 'password').
   * @default 'password'
   */
  passkeyField: string;

  /**
   * Secret for JWT.
   */
  jwtSecret: string;

  /**
   * JWT expiration time.
   * @default '1h'
   */
  expiresIn?: string;

  /**
   * Secret for Refresh JWT. Defaults to jwtSecret if not provided.
   */
  refreshTokenSecret?: string;

  /**
   * Refresh JWT expiration time.
   * @default '7d'
   */
  refreshTokenExpiresIn?: string;

  /**
   * Field to store refresh token in user entity.
   * @default 'refreshToken'
   */
  refreshTokenField?: string;

  /**
   * Field to store access token in user entity.
   * @default 'accessToken'
   */
  accessTokenField?: string;

  /**
   * Header name to look for refresh token.
   * @default 'x-refresh-token'
   */
  refreshTokenHeaderName?: string;

  /**
   * List of routes to disable (e.g., ['register']).
   */
  disabledRoutes?: string[];

  /**
   * DTO for login.
   */
  loginDto?: Type<unknown>;

  /**
   * DTO for registration.
   */
  registerDto?: Type<unknown>;

  /**
   * DTO for refreshing tokens.
   */
  refreshDto?: Type<unknown>;

  relations?: string[];

  /**
   * RBAC options.
   */
  rbac?: RbacOptions;
}
