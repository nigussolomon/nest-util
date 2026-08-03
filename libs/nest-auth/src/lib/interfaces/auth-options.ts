import { Type } from '@nestjs/common';
import { AuthRbacOptions } from './rbac-options.interface';
import { PermissionRegistryConfig } from './permission-registry.interface';
import { ApiKeyModuleOptions } from './api-key-options';
import { AuthRegisterHooks } from './register-hooks.interface';

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

export interface AuthOnboardingOptions {
  enabled?: boolean;
  codeLength?: number;
  ttlSeconds?: number;
  cooldownSeconds?: number;
  maxAttempts?: number;
  lockSeconds?: number;
  channel?: string;
  /**
   * Secret used to sign the one-purpose onboarding JWT returned after OTP
   * verification. Defaults to `jwtSecret`.
   */
  onboardingTokenSecret?: string;
  /**
   * Expiration for the one-purpose onboarding JWT.
   * @default '15m'
   */
  onboardingTokenExpiresIn?: string;
  startDto?: Type<unknown>;
  completeDto?: Type<unknown>;
  createUserDto?: Type<unknown>;
  metadata?: Record<string, unknown>;
  buildDeliveryContext?: (params: {
    identifier: string;
  }) => Record<string, unknown>;
  /**
   * REQUIRED callback — sends the OTP to the invitee's email/phone.
   */
  deliverCode?: OtpDeliveryCallback;
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

  /**
   * Which identifier field to deliver the post-register verification code to.
   * Defaults to the first identifier field present in the registration payload.
   */
  identifierField?: string;
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
   * Optional list of login identifier fields (e.g., ['email', 'phone']).
   * Takes precedence over `identifierField` when both are provided. Lookups
   * match any of these fields, so a user can log in with either value.
   */
  identifierFields?: string[];

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

  /**
   * Agent-assisted onboarding with OTP verification. The agent starts an
   * attempt (OTP delivered to the invitee), verifies the code the invitee
   * reads back, and receives a one-purpose onboarding JWT that guards a
   * single endpoint creating the user (with `registerHooks`). Independent of
   * the normal registration flow.
   */
  onboarding?: AuthOnboardingOptions;

  /**
   * Optional before/after registration hooks. Runs atomically with the user
   * creation inside a transaction — a throwing hook fails the registration.
   */
  registerHooks?: AuthRegisterHooks;
}
