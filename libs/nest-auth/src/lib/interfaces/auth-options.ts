import { Type } from '@nestjs/common';

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
}
