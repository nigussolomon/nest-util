import { Type } from '@nestjs/common';

export interface AuthModuleOptions {
  /**
   * The TypeORM entity for users.
   */
  userEntity: Type<any>;

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
   * Header name to look for refresh token.
   * @default 'x-refresh-token'
   */
  refreshTokenHeaderName?: string;

  /**
   * List of routes to disable (e.g., ['register']).
   */
  disabledRoutes?: string[];
}
