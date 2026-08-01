import { Type } from '@nestjs/common';
import { AuthRbacOptions } from './rbac-options.interface';
import { PermissionRegistryConfig } from './permission-registry.interface';
import { ApiKeyModuleOptions } from './api-key-options';

export interface OtpDeliveryPayload {
  identifier: string;
  code: string;
  channel: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export type OtpDeliveryCallback = (
  payload: OtpDeliveryPayload
) => Promise<void>;

export interface AuthOtpOptions {
  enabled?: boolean;
  codeLength?: number;
  ttlSeconds?: number;
  cooldownSeconds?: number;
  maxAttempts?: number;
  lockSeconds?: number;
  channel?: string;
  codeField?: string;
  expiresAtField?: string;
  attemptsField?: string;
  lastSentAtField?: string;
  lockUntilField?: string;
  inputCodeField?: string;
  requestDto?: Type<unknown>;
  loginDto?: Type<unknown>;
  metadata?: Record<string, unknown>;
  buildDeliveryContext?: (params: {
    identifier: string;
    user?: Record<string, unknown>;
  }) => Record<string, unknown>;
  deliverCode?: OtpDeliveryCallback;
}

export interface AuthPasswordResetOptions {
  enabled?: boolean;
  tokenLength?: number;
  tokenTtlSeconds?: number;
  tokenField?: string;
  expiresAtField?: string;
  requestDto?: Type<unknown>;
  resetDto?: Type<unknown>;
  buildResetContext?: (params: {
    identifier: string;
    user?: Record<string, unknown>;
  }) => Record<string, unknown>;
  deliverToken?: (payload: {
    identifier: string;
    token: string;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }) => Promise<void>;
}

export interface AuthVerificationOptions {
  enabled?: boolean;
  codeLength?: number;
  ttlSeconds?: number;
  cooldownSeconds?: number;
  maxAttempts?: number;
  lockSeconds?: number;
  channel?: string;
  verifiedField?: string;
  verifiedAtField?: string;
  codeHashField?: string;
  expiresAtField?: string;
  attemptsField?: string;
  lastSentAtField?: string;
  lockUntilField?: string;
  inputCodeField?: string;
  requestDto?: Type<unknown>;
  verifyDto?: Type<unknown>;
  deliverCode?: OtpDeliveryCallback;
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

  rbac?: AuthRbacOptions;

  permissionRegistry?: PermissionRegistryConfig;

  otp?: AuthOtpOptions;

  passwordReset?: AuthPasswordResetOptions;

  apiKey?: ApiKeyModuleOptions;

  verification?: AuthVerificationOptions;
}
