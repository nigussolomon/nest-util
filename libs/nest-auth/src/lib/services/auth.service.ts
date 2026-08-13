import {
  Injectable,
  Inject,
  Optional,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, IsNull, Like } from 'typeorm';
import type { Repository, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUTH_OPTIONS } from '../constants';
import type {
  AuthModuleOptions,
  AuthOnboardingOptions,
  AuthPasswordResetOptions,
  AuthVerificationOptions,
} from '../interfaces/auth-options';
import type { AuthOtpOptions } from '../interfaces/auth-options';
import { AuthUser, AuthTokens } from '../interfaces/user.interface';
import { RoleEntity } from '../entities/role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { OnboardingAttemptEntity } from '../entities/onboarding-attempt.entity';
import { CreateRoleDto } from '../dtos/create-role.dto';
import {
  UserListParams,
  UserListResult,
  UserManagementOptions,
} from '../interfaces/user-management-options.interface';

interface AuditEvent {
  action: string;
  entity: string;
  entityId?: unknown;
  userId?: unknown;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ResolvedOtpOptions {
  codeLength: number;
  ttlSeconds: number;
  cooldownSeconds: number;
  maxAttempts: number;
  lockSeconds: number;
  channel: string;
  codeField: string;
  expiresAtField: string;
  attemptsField: string;
  lastSentAtField: string;
  lockUntilField: string;
  inputCodeField: string;
}

interface ResolvedPasswordResetOptions {
  tokenLength: number;
  tokenTtlSeconds: number;
  tokenField: string;
  expiresAtField: string;
  cooldownSeconds: number;
  maxAttempts: number;
  lockSeconds: number;
  attemptsField: string;
  lockUntilField: string;
  lastRequestAtField: string;
}

interface ResolvedLoginAttemptOptions {
  enabled: boolean;
  maxAttempts: number;
  lockSeconds: number;
  attemptsField: string;
  lockUntilField: string;
}

interface ResolvedVerificationOptions {
  codeLength: number;
  ttlSeconds: number;
  cooldownSeconds: number;
  maxAttempts: number;
  lockSeconds: number;
  channel: string;
  verifiedField: string;
  verifiedAtField: string;
  codeHashField: string;
  expiresAtField: string;
  attemptsField: string;
  lastSentAtField: string;
  lockUntilField: string;
  inputCodeField: string;
}

interface ResolvedOnboardingOptions {
  codeLength: number;
  ttlSeconds: number;
  cooldownSeconds: number;
  maxAttempts: number;
  lockSeconds: number;
  channel: string;
  tokenSecret: string;
  tokenExpiresIn: string;
}

interface CreateUserConfig {
  hashedPassword?: string;
  verified?: boolean;
  verifiedAt?: Date;
  onSaved?: (manager: EntityManager, saved: Record<string, unknown>) => Promise<void>;
}

@Injectable()
export class AuthService {
  private readonly userRepository: Repository<Record<string, unknown>>;
  private readonly roleRepository: Repository<RoleEntity>;
  private readonly userRoleRepository: Repository<UserRoleEntity>;
  private readonly onboardingAttemptRepository: Repository<OnboardingAttemptEntity>;

  constructor(
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
    private readonly jwtService: JwtService,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Optional() @Inject(EventEmitter2) private readonly eventEmitter?: EventEmitter2
  ) {
    this.userRepository = this.dataSource.getRepository(
      this.options.userEntity
    ) as Repository<Record<string, unknown>>;
    this.roleRepository = this.dataSource.getRepository(RoleEntity);
    this.userRoleRepository = this.dataSource.getRepository(UserRoleEntity);
    this.onboardingAttemptRepository =
      this.dataSource.getRepository(OnboardingAttemptEntity);
  }

  private emitAuthEvent(action: string, data: Partial<AuditEvent> = {}): void {
    if (!this.eventEmitter) return;
    this.eventEmitter.emit(action, {
      action,
      entity: 'user',
      timestamp: new Date(),
      ...data,
    });
  }

  private getIdentifierFields(): string[] {
    return this.options.identifierFields?.length
      ? this.options.identifierFields
      : [this.options.identifierField];
  }

  private getIdentifierLabel(): string {
    return this.getIdentifierFields().join(' or ');
  }

  private buildIdentifierOrCondition(alias: string): string {
    return this.getIdentifierFields()
      .map((field) => `${alias}.${field} = :identifier`)
      .join(' OR ');
  }

  private getPresentIdentifiers(data: Record<string, unknown>): {
    field: string;
    value: string;
  }[] {
    return this.getIdentifierFields()
      .map((field) => ({ field, value: data[field] }))
      .filter(
        (entry): entry is { field: string; value: string } =>
          typeof entry.value === 'string' && entry.value.trim().length > 0
      );
  }

  private resolveVerificationIdentifier(
    presentIdentifiers: { field: string; value: string }[]
  ): string {
    const override = this.options.verification?.identifierField;
    if (override) {
      const matched = presentIdentifiers.find(({ field }) => field === override);
      if (!matched) {
        throw new BadRequestException(
          `verification.identifierField '${override}' was not provided in the registration payload`
        );
      }
      return matched.value.trim();
    }
    return presentIdentifiers[0].value.trim();
  }

  async register(data: Record<string, unknown>): Promise<AuthUser> {
    const password = data[this.options.passkeyField] as string;

    const presentIdentifiers = this.getPresentIdentifiers(data);

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    const existingUser = await this.userRepository.findOne({
      where: presentIdentifiers.map(({ field, value }) => ({
        [field]: value.trim(),
      })) as never,
    });

    if (existingUser) {
      this.emitAuthEvent('auth.user.register.conflict', {
        metadata: { identifier: presentIdentifiers[0].value },
      });
      throw new ConflictException('User already exists');
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const verificationEnabled = this.options.verification?.enabled;

    const savedUser = await this.createUserWithHooks(data, {
      hashedPassword,
      ...(verificationEnabled ? { verified: false } : {}),
    });

    this.emitAuthEvent('auth.user.register.success', {
      entityId: (savedUser as any).id,
      userId: (savedUser as any).id,
      metadata: {
        identifier: presentIdentifiers[0].value,
        identifiers: presentIdentifiers.map(({ field, value }) => ({
          [field]: value,
        })),
      },
    });

    if (verificationEnabled) {
      const deliveryIdentifier =
        this.resolveVerificationIdentifier(presentIdentifiers);
      try {
        await this.generateAndSendVerificationOtp(
          (savedUser as any).id as string | number,
          deliveryIdentifier
        );
      } catch {
        await this.userRepository.delete((savedUser as any).id);
        throw new InternalServerErrorException(
          'Failed to send verification code'
        );
      }
    }

    return this.removeSensitiveData(savedUser);
  }

  async login(credentials: Record<string, unknown>): Promise<AuthTokens> {
    const password = credentials[this.options.passkeyField] as string;
    const loginConfig = this.getLoginAttemptOptions();

    const presentIdentifiers = this.getPresentIdentifiers(credentials);
    if (presentIdentifiers.length === 0) {
      this.emitAuthEvent('auth.user.login.failed.user_not_found', {
        metadata: { identifier: undefined },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    const identifier = presentIdentifiers[0].value;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${this.options.passkeyField}`)
      .addSelect(`user.${loginConfig.attemptsField}`)
      .addSelect(`user.${loginConfig.lockUntilField}`)
      .where(this.buildIdentifierOrCondition('user'), { identifier })
      .getOne();

    if (!user) {
      this.emitAuthEvent('auth.user.login.failed.user_not_found', { metadata: { identifier } });
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();
    const lockUntil = this.toDate(user[loginConfig.lockUntilField]);
    if (loginConfig.enabled && lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.user.login.failed.locked', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier, lockUntil },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.options.verification?.enabled) {
      const verifiedField = this.options.verification.verifiedField ?? 'isVerified';
      if (!user[verifiedField]) {
        this.emitAuthEvent('auth.user.login.failed.unverified', {
          entityId: user.id,
          userId: user.id,
          metadata: { identifier },
        });
        throw new UnauthorizedException('Account not verified');
      }
    }

    const isPasswordValid = user[this.options.passkeyField]
      ? await bcrypt.compare(
          password,
          user[this.options.passkeyField] as string
        )
      : false;

    if (!isPasswordValid) {
      if (loginConfig.enabled) {
        const currentAttempts = this.toNumber(user[loginConfig.attemptsField]);
        const nextAttempts = currentAttempts + 1;

        const updatePayload: Record<string, unknown> = {
          [loginConfig.attemptsField]: nextAttempts,
        };

        if (nextAttempts >= loginConfig.maxAttempts) {
          updatePayload[loginConfig.lockUntilField] = new Date(
            now.getTime() + loginConfig.lockSeconds * 1000
          );
        }

        await this.updateLoginState(user.id as string | number, updatePayload);
      }

      this.emitAuthEvent('auth.user.login.failed.invalid_password', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (loginConfig.enabled) {
      await this.updateLoginState(user.id as string | number, {
        [loginConfig.attemptsField]: 0,
        [loginConfig.lockUntilField]: null,
      });
    }

    this.emitAuthEvent('auth.user.login.success', {
      entityId: user.id,
      userId: user.id,
      metadata: { identifier },
    });
    return await this.generateTokens(user);
  }

  async requestOtp(
    data: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> {
    const otpOptions = this.getOtpOptions();
    const otpConfig = this.resolveOtpOptions(otpOptions);
    const presentIdentifiers = this.getPresentIdentifiers(data);

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    const normalizedIdentifier = presentIdentifiers[0].value.trim();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${otpConfig.codeField}`)
      .addSelect(`user.${otpConfig.expiresAtField}`)
      .addSelect(`user.${otpConfig.attemptsField}`)
      .addSelect(`user.${otpConfig.lastSentAtField}`)
      .addSelect(`user.${otpConfig.lockUntilField}`)
      .where(this.buildIdentifierOrCondition('user'), {
        identifier: normalizedIdentifier,
      })
      .getOne();

    // Avoid account enumeration by returning the same response for unknown users.
    if (!user) {
      this.emitAuthEvent('auth.otp.request.user_not_found', { metadata: { identifier: normalizedIdentifier } });
      return { success: true, message: 'OTP has been sent if the user exists' };
    }

    const now = new Date();
    const lockUntil = this.toDate(user[otpConfig.lockUntilField]);
    if (lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.otp.request.locked', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier, lockUntil },
      });
      return {
        success: false,
        message:
          'OTP requests are temporarily locked due to multiple failed attempts',
      };
    }

    const lastSentAt = this.toDate(user[otpConfig.lastSentAtField]);
    if (
      lastSentAt &&
      now.getTime() - lastSentAt.getTime() < otpConfig.cooldownSeconds * 1000
    ) {
      this.emitAuthEvent('auth.otp.request.cooldown', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });
      return { success: false, message: 'OTP request is on cooldown' };
    }

    const code = this.generateOtpCode(otpConfig.codeLength);
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(now.getTime() + otpConfig.ttlSeconds * 1000);

    await this.updateOtpState(user.id as string | number, {
      [otpConfig.codeField]: hashedCode,
      [otpConfig.expiresAtField]: expiresAt,
      [otpConfig.attemptsField]: 0,
      [otpConfig.lastSentAtField]: now,
      [otpConfig.lockUntilField]: null,
    });

    try {
      await otpOptions.deliverCode!({
        identifier: normalizedIdentifier,
        code,
        channel: otpOptions.channel || otpConfig.channel,
        expiresAt,
        metadata: otpOptions.metadata,
        context: otpOptions.buildDeliveryContext?.({
          identifier: normalizedIdentifier,
          user,
        }),
      });
    } catch {
      await this.clearOtpState(user.id as string | number, otpConfig);
      this.emitAuthEvent('auth.otp.request.delivery_failed', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier, channel: otpOptions.channel || otpConfig.channel },
      });
      throw new InternalServerErrorException('Failed to deliver OTP');
    }

    this.emitAuthEvent('auth.otp.request.success', {
      entityId: user.id,
      userId: user.id,
      metadata: { identifier: normalizedIdentifier, channel: otpOptions.channel || otpConfig.channel },
    });
    return { success: true };
  }

  async loginWithOtp(
    credentials: Record<string, unknown>
  ): Promise<AuthTokens> {
    const otpConfig = this.resolveOtpOptions(this.getOtpOptions());

    const presentIdentifiers = this.getPresentIdentifiers(credentials);
    const otpCode = credentials[otpConfig.inputCodeField];

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException({
        code: 'IDENTIFIER_REQUIRED',
        message: `${this.getIdentifierLabel()} is required`,
      });
    }

    if (typeof otpCode !== 'string' || !otpCode.trim()) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: `${otpConfig.inputCodeField} is required`,
      });
    }

    const normalizedIdentifier = presentIdentifiers[0].value.trim();
    const normalizedOtp = otpCode.trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${otpConfig.codeField}`)
      .addSelect(`user.${otpConfig.expiresAtField}`)
      .addSelect(`user.${otpConfig.attemptsField}`)
      .addSelect(`user.${otpConfig.lockUntilField}`)
      .where(this.buildIdentifierOrCondition('user'), {
        identifier: normalizedIdentifier,
      })
      .getOne();

    if (!user) {
      this.emitAuthEvent('auth.otp.login.failed.user_not_found', { metadata: { identifier: normalizedIdentifier } });
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const now = new Date();

    const lockUntil = this.toDate(user[otpConfig.lockUntilField]);

    if (lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.otp.login.failed.locked', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier, lockUntil },
      });
      throw new BadRequestException({
        code: 'OTP_LOCKED',
        message: 'Too many OTP attempts',
        lockUntil,
      });
    }

    const storedOtpHash = user[otpConfig.codeField] as string | null;
    const expiresAt = this.toDate(user[otpConfig.expiresAtField]);

    if (!storedOtpHash) {
      this.emitAuthEvent('auth.otp.login.failed.not_requested', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });
      throw new UnauthorizedException({
        code: 'OTP_NOT_REQUESTED',
        message: 'No OTP has been generated',
      });
    }

    if (!expiresAt) {
      throw new UnauthorizedException({
        code: 'OTP_INVALID_STATE',
        message: 'OTP expiration is missing',
      });
    }

    if (expiresAt <= now) {
      await this.clearOtpState(user.id as string | number, otpConfig);
      this.emitAuthEvent('auth.otp.login.failed.expired', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });

      throw new UnauthorizedException({
        code: 'OTP_EXPIRED',
        message: 'OTP has expired',
      });
    }

    const isOtpValid = await bcrypt.compare(normalizedOtp, storedOtpHash);

    if (!isOtpValid) {
      const currentAttempts = this.toNumber(user[otpConfig.attemptsField]);
      const nextAttempts = currentAttempts + 1;

      const updatePayload: Record<string, unknown> = {
        [otpConfig.attemptsField]: nextAttempts,
      };

      if (nextAttempts >= otpConfig.maxAttempts) {
        const nextLockUntil = new Date(
          now.getTime() + otpConfig.lockSeconds * 1000
        );

        updatePayload[otpConfig.lockUntilField] = nextLockUntil;

        await this.updateOtpState(user.id as string | number, updatePayload);
        this.emitAuthEvent('auth.otp.login.failed.max_attempts', {
          entityId: user.id,
          userId: user.id,
          metadata: { identifier: normalizedIdentifier, lockUntil: nextLockUntil },
        });

        throw new BadRequestException({
          code: 'OTP_MAX_ATTEMPTS_REACHED',
          message: 'Maximum OTP attempts reached',
          lockUntil: nextLockUntil,
        });
      }

      await this.updateOtpState(user.id as string | number, updatePayload);

      this.emitAuthEvent('auth.otp.login.failed.invalid', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier, attemptsRemaining: otpConfig.maxAttempts - nextAttempts },
      });
      throw new UnauthorizedException({
        code: 'OTP_INVALID',
        message: 'Invalid OTP code',
        attemptsRemaining: otpConfig.maxAttempts - nextAttempts,
      });
    }

    await this.clearOtpState(user.id as string | number, otpConfig);

    this.emitAuthEvent('auth.otp.login.success', {
      entityId: user.id,
      userId: user.id,
      metadata: { identifier: normalizedIdentifier },
    });
    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const secret = this.options.refreshTokenSecret || this.options.jwtSecret;

    try {
      const payload = this.jwtService.verify(refreshToken, { secret });
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect(`user.${refreshTokenField}`)
        .where({ id: payload.sub })
        .getOne();

      if (!user) {
        this.emitAuthEvent('auth.token.refresh.failed', { metadata: { reason: 'Invalid refresh token' } });
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (this.options.verification?.enabled) {
        const verifiedField = this.options.verification.verifiedField ?? 'isVerified';
        if (!user[verifiedField]) {
          this.emitAuthEvent('auth.token.refresh.failed', { userId: payload.sub, metadata: { reason: 'Account not verified' } });
          throw new UnauthorizedException('Account not verified');
        }
      }

      const storedHash = user[refreshTokenField] as string;
      if (!storedHash) {
        this.emitAuthEvent('auth.token.refresh.failed', { userId: payload.sub, metadata: { reason: 'Invalid refresh token' } });
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenValid = await bcrypt.compare(payload.nonce, storedHash);
      if (!isTokenValid) {
        this.emitAuthEvent('auth.token.refresh.failed', { userId: payload.sub, metadata: { reason: 'Refresh token reused or invalid' } });
        throw new UnauthorizedException('Refresh token reused or invalid');
      }

      this.emitAuthEvent('auth.token.refresh.success', {
        entityId: user.id,
        userId: user.id,
        metadata: { sub: payload.sub },
      });
      return await this.generateTokens(user);
    } catch (e: unknown) {
      if (e instanceof UnauthorizedException) throw e;
      this.emitAuthEvent('auth.token.refresh.failed', { metadata: { reason: 'Invalid refresh token' } });
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: number | string): Promise<boolean> {
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const accessTokenField = this.options.accessTokenField || 'accessToken';

    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set({ [refreshTokenField]: null, [accessTokenField]: null })
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      this.emitAuthEvent('auth.user.logout.failed', { userId, metadata: { reason: 'No user affected' } });
      throw new UnauthorizedException('Failed to logout');
    }

    this.emitAuthEvent('auth.user.logout.success', { entityId: userId, userId });
    return true;
  }

  async changePassword(
    userId: number | string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const passkeyField = this.options.passkeyField;
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${passkeyField}`)
      .where({ id: userId })
      .getOne();

    if (!user) {
      this.emitAuthEvent('auth.password.change.failed.user_not_found', { userId, metadata: { reason: 'User not found' } });
      throw new NotFoundException('User not found');
    }

    const storedPassword = user[passkeyField] as string | undefined;

    if (storedPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        storedPassword
      );

      if (!isCurrentPasswordValid) {
        this.emitAuthEvent('auth.password.change.failed.current_password_wrong', {
          entityId: userId,
          userId,
          metadata: { reason: 'Current password is incorrect' },
        });
        throw new UnauthorizedException('Current password is incorrect');
      }
    } else {
      this.emitAuthEvent('auth.password.change.failed.no_password_set', {
        entityId: userId,
        userId,
        metadata: { reason: 'User does not have a password set' },
      });
      throw new BadRequestException('User does not have a password set');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set({ [passkeyField]: hashedNewPassword })
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      throw new InternalServerErrorException('Failed to change password');
    }

    this.emitAuthEvent('auth.password.change.success', { entityId: userId, userId });
    return { success: true, message: 'Password changed successfully' };
  }

  async requestPasswordReset(
    data: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> {
    const resetOptions = this.getPasswordResetOptions();
    const resetConfig = this.resolvePasswordResetOptions(resetOptions);

    const presentIdentifiers = this.getPresentIdentifiers(data);

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    const normalizedIdentifier = presentIdentifiers[0].value.trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${resetConfig.tokenField}`)
      .addSelect(`user.${resetConfig.expiresAtField}`)
      .addSelect(`user.${resetConfig.attemptsField}`)
      .addSelect(`user.${resetConfig.lockUntilField}`)
      .addSelect(`user.${resetConfig.lastRequestAtField}`)
      .where(this.buildIdentifierOrCondition('user'), {
        identifier: normalizedIdentifier,
      })
      .getOne();

    // Prevent account enumeration
    if (!user) {
      this.emitAuthEvent('auth.password.reset.request.user_not_found', { metadata: { identifier: normalizedIdentifier } });
      return {
        success: true,
        message:
          'Password reset instructions have been sent if the account exists',
      };
    }

    const now = new Date();
    const lockUntil = this.toDate(user[resetConfig.lockUntilField]);
    if (lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.password.reset.request.locked', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier, lockUntil },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const lastRequestAt = this.toDate(user[resetConfig.lastRequestAtField]);
    if (
      lastRequestAt &&
      now.getTime() - lastRequestAt.getTime() <
        resetConfig.cooldownSeconds * 1000
    ) {
      this.emitAuthEvent('auth.password.reset.request.cooldown', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = crypto
      .randomBytes(Math.ceil(resetConfig.tokenLength / 2))
      .toString('hex')
      .slice(0, resetConfig.tokenLength);

    const hashedToken = await bcrypt.hash(token, 10);

    const expiresAt = new Date(Date.now() + resetConfig.tokenTtlSeconds * 1000);

    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set({
        [resetConfig.tokenField]: hashedToken,
        [resetConfig.expiresAtField]: expiresAt,
        [resetConfig.attemptsField]: 0,
        [resetConfig.lockUntilField]: null,
        [resetConfig.lastRequestAtField]: now,
      })
      .where('id = :id', {
        id: user.id as string | number,
      })
      .execute();

    if (updateResult.affected === 0) {
      throw new InternalServerErrorException('Failed to create reset token');
    }

    try {
      await resetOptions.deliverToken!({
        identifier: normalizedIdentifier,
        token,
        expiresAt,
        metadata: {},
        context: resetOptions.buildResetContext?.({
          identifier: normalizedIdentifier,
          user,
        }),
      });
    } catch {
      await this.clearPasswordResetState(
        user.id as string | number,
        resetConfig
      );
      this.emitAuthEvent('auth.password.reset.request.delivery_failed', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });

      throw new InternalServerErrorException('Failed to deliver reset token');
    }

    this.emitAuthEvent('auth.password.reset.request.success', {
      entityId: user.id,
      userId: user.id,
      metadata: { identifier: normalizedIdentifier, expiresAt },
    });
    return { success: true };
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const resetConfig = this.resolvePasswordResetOptions(
      this.getPasswordResetOptions()
    );

    if (!token?.trim()) {
      throw new BadRequestException('Reset token is required');
    }

    if (!newPassword?.trim()) {
      throw new BadRequestException('New password is required');
    }

    const users = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${resetConfig.tokenField}`)
      .addSelect(`user.${resetConfig.expiresAtField}`)
      .addSelect(`user.${resetConfig.attemptsField}`)
      .addSelect(`user.${resetConfig.lockUntilField}`)
      .addSelect(`user.${resetConfig.lastRequestAtField}`)
      .getMany();

    const now = new Date();

    let matchedUser: Record<string, unknown> | null = null;

    for (const user of users) {
      const storedHash = user[resetConfig.tokenField] as string | null;

      if (!storedHash) {
        continue;
      }

      const isMatch = await bcrypt.compare(token, storedHash);

      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      this.emitAuthEvent('auth.password.reset.failed.invalid_token', { metadata: { reason: 'Invalid reset token' } });
      throw new BadRequestException('Invalid reset token');
    }

    const lockUntil = this.toDate(matchedUser[resetConfig.lockUntilField]);
    if (lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.password.reset.failed.locked', {
        entityId: matchedUser.id,
        userId: matchedUser.id,
        metadata: { reason: 'Account temporarily locked' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const expiresAt = this.toDate(matchedUser[resetConfig.expiresAtField]);

    if (!expiresAt || expiresAt <= now) {
      await this.recordFailedPasswordReset(
        matchedUser.id as string | number,
        matchedUser,
        resetConfig,
        now
      );
      await this.clearPasswordResetState(
        matchedUser.id as string | number,
        resetConfig
      );
      this.emitAuthEvent('auth.password.reset.failed.expired', {
        entityId: matchedUser.id,
        userId: matchedUser.id,
        metadata: { reason: 'Reset token has expired' },
      });

      throw new BadRequestException('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set({
        [this.options.passkeyField]: hashedPassword,
        [resetConfig.tokenField]: null,
        [resetConfig.expiresAtField]: null,
        [resetConfig.attemptsField]: 0,
        [resetConfig.lockUntilField]: null,
        [resetConfig.lastRequestAtField]: null,
        [this.options.refreshTokenField ?? 'refreshToken']: null,
        [this.options.accessTokenField ?? 'accessToken']: null,
      })
      .where('id = :id', {
        id: matchedUser.id as string | number,
      })
      .execute();

    if (updateResult.affected === 0) {
      throw new InternalServerErrorException('Failed to reset password');
    }

    this.emitAuthEvent('auth.password.reset.success', {
      entityId: matchedUser.id,
      userId: matchedUser.id,
    });
    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async createRole(data: CreateRoleDto): Promise<RoleEntity> {
    const roleName = typeof data.name === 'string' ? data.name.trim() : '';

    if (!roleName) {
      throw new BadRequestException('Role name is required');
    }

    const existingRole = await this.roleRepository.findOne({
      where: { name: roleName },
    });

    if (existingRole) {
      this.emitAuthEvent('auth.role.created.conflict', { metadata: { roleName } });
      throw new ConflictException('Role already exists');
    }

    const role = this.roleRepository.create({
      name: roleName,
      description:
        typeof data.description === 'string'
          ? data.description.trim() || undefined
          : undefined,
      permissions: this.toPermissionArray(data.permissions),
    });

    const savedRole = await this.roleRepository.save(role);
    this.emitAuthEvent('auth.role.created', {
      entity: 'role',
      entityId: savedRole.id,
      userId: undefined,
      metadata: { roleName, permissions: savedRole.permissions },
    });
    return savedRole;
  }

  async assignRoleToUser(userId: number, roleId: number): Promise<RoleEntity> {
    await this.assertUserExists(userId);

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existingAssignment = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });

    if (!existingAssignment) {
      const assignment = this.userRoleRepository.create({ userId, roleId });
      await this.userRoleRepository.save(assignment);
    }

    this.emitAuthEvent('auth.role.assigned', {
      entity: 'role',
      entityId: roleId,
      metadata: { targetUserId: userId, targetRoleId: roleId, roleName: role.name },
    });
    return role;
  }

  async assignPermissionsToRole(
    roleId: number,
    permissions: unknown
  ): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const parsedPermissions = this.toPermissionArray(permissions);
    if (parsedPermissions.length === 0) {
      throw new BadRequestException('Permissions are required');
    }

    const currentPermissions = Array.isArray(role.permissions)
      ? role.permissions
      : [];

    role.permissions = [
      ...new Set([...currentPermissions, ...parsedPermissions]),
    ];
    const saved = await this.roleRepository.save(role);
    this.emitAuthEvent('auth.role.permissions.added', {
      entity: 'role',
      entityId: roleId,
      metadata: { roleName: role.name, addedPermissions: parsedPermissions, allPermissions: saved.permissions },
    });
    return saved;
  }

  async removePermissionsFromRole(
    roleId: number,
    permissions: unknown
  ): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const parsedPermissions = this.toPermissionArray(permissions);
    if (parsedPermissions.length === 0) {
      throw new BadRequestException('Permissions are required');
    }

    const currentPermissions = Array.isArray(role.permissions)
      ? role.permissions
      : [];

    role.permissions = currentPermissions.filter(
      (permission) => !parsedPermissions.includes(permission)
    );

    const saved = await this.roleRepository.save(role);
    this.emitAuthEvent('auth.role.permissions.removed', {
      entity: 'role',
      entityId: roleId,
      metadata: { roleName: role.name, removedPermissions: parsedPermissions, remainingPermissions: saved.permissions },
    });
    return saved;
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
    await this.assertUserExists(userId);

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const result = await this.userRoleRepository.delete({ userId, roleId });
    const removed = (result.affected ?? 0) > 0;
    if (removed) {
      this.emitAuthEvent('auth.role.removed', {
        entity: 'role',
        entityId: roleId,
        metadata: { targetUserId: userId, targetRoleId: roleId },
      });
    }
    return removed;
  }

  async getUserRoles(userId: number): Promise<RoleEntity[]> {
    await this.assertUserExists(userId);

    const assignments = await this.userRoleRepository.find({
      where: { userId },
      relations: {
        role: true
      },
    });

    return assignments
      .map((assignment) => assignment.role)
      .filter((role): role is RoleEntity => Boolean(role));
  }

  async getAllRoles(): Promise<RoleEntity[]> {
    return await this.roleRepository.find({
      order: { id: 'ASC' },
    });
  }

  async listUsers(params: UserListParams = {}): Promise<UserListResult> {
    const config = this.resolveUserManagementConfig();
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(config.maxLimit, Math.max(1, params.limit ?? 20));

    const baseFilter: Record<string, unknown> = {};
    if (typeof params.active === 'boolean') {
      baseFilter[config.activeField] = params.active;
    }

    const searchFilters: Record<string, unknown>[] = [];
    const query = params.q?.trim();
    if (query) {
      for (const field of this.getIdentifierFields()) {
        searchFilters.push({ ...baseFilter, [field]: Like(`%${query}%`) });
      }
    } else if (Object.keys(baseFilter).length > 0) {
      searchFilters.push(baseFilter);
    }

    const findOptions: Record<string, unknown> = {
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    };
    if (searchFilters.length > 0) {
      findOptions.where = searchFilters;
    }
    if (config.relations?.length) {
      findOptions.relations = this.buildRelationsObject(config.relations);
    }

    const [items, total] = await this.userRepository.findAndCount(
      findOptions as never
    );

    return {
      items: items.map((item) => this.toUserResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getUserById(id: number): Promise<Record<string, unknown>> {
    return this.toUserResponse(await this.getUserByIdInternal(id));
  }

  async createUserByAdmin(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const config = this.resolveUserManagementConfig();

    const presentIdentifiers = this.getPresentIdentifiers(data);
    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    const existingUser = await this.userRepository.findOne({
      where: presentIdentifiers.map(({ field, value }) => ({
        [field]: value.trim(),
      })) as never,
    });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const allowed = new Set<string>(config.createFields ?? []);
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const isIdentifier = this.getIdentifierFields().includes(key);
      const isPassword =
        config.allowPassword !== false && key === this.options.passkeyField;

      if (config.createFields?.length) {
        if (allowed.has(key) || isIdentifier || isPassword) {
          payload[key] = value;
          continue;
        }
        throw new BadRequestException(
          `Field '${key}' is not allowed in the user payload`
        );
      }

      if (isPassword) {
        payload[key] = value;
        continue;
      }
      if (this.isSensitiveField(key)) {
        throw new BadRequestException(`Field '${key}' is not allowed`);
      }
      payload[key] = value;
    }

    if (payload[config.activeField] === undefined) {
      payload[config.activeField] = true;
    }

    const password = payload[this.options.passkeyField];
    delete payload[this.options.passkeyField];

    const hashedPassword =
      typeof password === 'string' && password.length > 0
        ? await bcrypt.hash(password, 10)
        : undefined;

    const saved = await this.createUserWithHooks(payload, {
      hashedPassword,
    });

    return this.toUserResponse(saved);
  }

  async updateUser(
    id: number,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const config = this.resolveUserManagementConfig();

    await this.getUserByIdInternal(id);

    const patch = this.buildPatch(data, config.updateFields, {
      rejectPassword: true,
      target: 'update',
    });

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No updatable fields provided');
    }

    await this.userRepository.update(id, patch as never);

    return this.toUserResponse(await this.getUserByIdInternal(id));
  }

  async updateProfile(
    userId: number,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const config = this.resolveUserManagementConfig();

    await this.getUserByIdInternal(userId);

    const patch = this.buildPatch(
      data,
      config.profileFields ?? config.updateFields,
      {
        forbid: [config.activeField],
        rejectPassword: true,
        allowIdentifiers: config.profileFields?.length ? false : true,
        target: 'profile update',
      }
    );

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No updatable fields provided');
    }

    await this.userRepository.update(userId, patch as never);

    return this.toUserResponse(await this.getUserByIdInternal(userId));
  }

  async setUserActive(
    id: number,
    active: boolean
  ): Promise<Record<string, unknown>> {
    const config = this.resolveUserManagementConfig();

    await this.getUserByIdInternal(id);

    await this.userRepository.update(id, {
      [config.activeField]: active,
    } as never);

    return this.toUserResponse(await this.getUserByIdInternal(id));
  }

  async deleteUser(id: number): Promise<boolean> {
    await this.getUserByIdInternal(id);

    await this.userRepository.delete(id);

    return true;
  }

  private resolveUserManagementConfig(): Required<
    Pick<
      UserManagementOptions,
      | 'enabled'
      | 'permission'
      | 'profilePermission'
      | 'activeField'
      | 'allowPassword'
      | 'maxLimit'
    >
  > &
    Pick<
      UserManagementOptions,
      | 'listFields'
      | 'createFields'
      | 'updateFields'
      | 'profileFields'
      | 'relations'
    > {
    const config = this.options.userManagement ?? {};
    return {
      enabled: config.enabled ?? true,
      permission: config.permission ?? 'admin.access',
      profilePermission: config.profilePermission ?? 'profile.edit',
      activeField: config.activeField ?? 'isActive',
      listFields: config.listFields,
      createFields: config.createFields,
      updateFields: config.updateFields,
      profileFields: config.profileFields,
      relations: config.relations ?? this.options.relations,
      allowPassword: config.allowPassword ?? true,
      maxLimit: config.maxLimit ?? 100,
    };
  }

  private getSensitiveFields(): string[] {
    const otp = this.options.otp ?? {};
    const verification = this.options.verification ?? {};
    const passwordReset = this.options.passwordReset ?? {};
    const loginAttempts = this.options.loginAttempts ?? {};

    return [
      this.options.passkeyField,
      this.options.refreshTokenField || 'refreshToken',
      this.options.accessTokenField || 'accessToken',
      loginAttempts.attemptsField,
      loginAttempts.lockUntilField,
      otp.codeField,
      otp.expiresAtField,
      otp.attemptsField,
      otp.lastSentAtField,
      otp.lockUntilField,
      verification.verifiedField,
      verification.verifiedAtField,
      verification.codeHashField,
      verification.expiresAtField,
      verification.attemptsField,
      verification.lastSentAtField,
      verification.lockUntilField,
      passwordReset.tokenField,
      passwordReset.expiresAtField,
      passwordReset.attemptsField,
      passwordReset.lockUntilField,
      passwordReset.lastRequestAtField,
    ].filter(
      (field): field is string =>
        typeof field === 'string' && field.trim().length > 0
    );
  }

  private isSensitiveField(key: string): boolean {
    return this.getSensitiveFields().includes(key);
  }

  private toUserResponse(user: Record<string, unknown>): Record<string, unknown> {
    const config = this.resolveUserManagementConfig();

    if (config.listFields?.length) {
      const out: Record<string, unknown> = { id: user.id };
      for (const field of config.listFields) {
        if (user[field] !== undefined) {
          out[field] = user[field];
        }
      }
      return out;
    }

    const sensitive = new Set(this.getSensitiveFields());
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(user)) {
      if (!sensitive.has(key)) {
        out[key] = value;
      }
    }
    return out;
  }

  private async getUserByIdInternal(
    id: number
  ): Promise<Record<string, unknown>> {
    const config = this.resolveUserManagementConfig();

    const user = await this.userRepository.findOne({
      where: { id } as never,
      ...(config.relations?.length
        ? { relations: this.buildRelationsObject(config.relations) }
        : {}),
    } as never);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private buildRelationsObject(
    relations: readonly string[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const relation of relations) {
      const parts = relation.split('.');
      let current = result;
      for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        if (isLast) {
          current[parts[i]] = true;
        } else {
          if (!(parts[i] in current) || current[parts[i]] === true) {
            current[parts[i]] = {};
          }
          current = current[parts[i]] as Record<string, unknown>;
        }
      }
    }
    return result;
  }

  private buildPatch(
    data: Record<string, unknown>,
    whitelist: readonly string[] | undefined,
    options: {
      forbid?: readonly string[];
      rejectPassword?: boolean;
      allowIdentifiers?: boolean;
      target?: string;
    } = {}
  ): Record<string, unknown> {
    const target = options.target ?? 'update';
    const allowed = new Set<string>(whitelist ?? []);
    const allowIdentifiers = options.allowIdentifiers ?? true;
    const patch: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (options.rejectPassword && key === this.options.passkeyField) {
        throw new BadRequestException(
          `Field '${key}' is not allowed via user ${target}`
        );
      }
      if (options.forbid?.includes(key)) {
        throw new BadRequestException(`Field '${key}' is not allowed`);
      }

      const isIdentifier = this.getIdentifierFields().includes(key);

      if (whitelist?.length) {
        if (allowed.has(key) || (allowIdentifiers && isIdentifier)) {
          patch[key] = value;
          continue;
        }
        throw new BadRequestException(
          `Field '${key}' is not allowed in the user ${target}`
        );
      }

      if (this.isSensitiveField(key)) {
        throw new BadRequestException(`Field '${key}' is not allowed`);
      }
      patch[key] = value;
    }

    return patch;
  }

  private async generateTokens(
    user: Record<string, unknown>
  ): Promise<AuthTokens> {
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const accessTokenField = this.options.accessTokenField || 'accessToken';
    const payload: Record<string, unknown> = { sub: user.id };

    for (const field of this.getIdentifierFields()) {
      if (user[field] !== undefined) {
        payload[field] = user[field];
      }
    }

    const refreshPayload = {
      ...payload,
      nonce: crypto.randomUUID(),
    };

    const accessTokenPayload = {
      ...payload,
      nonce: crypto.randomUUID(),
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.options.jwtSecret,
      expiresIn: '15m',
    });

    const refreshSecret =
      this.options.refreshTokenSecret || this.options.jwtSecret;
    const refreshExpiresIn = this.options.refreshTokenExpiresIn || '7d';

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: refreshExpiresIn as any,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshPayload.nonce, 10);
    const hashedAccessToken = await bcrypt.hash(accessTokenPayload.nonce, 10);

    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set({
        [refreshTokenField]: hashedRefreshToken,
        [accessTokenField]: hashedAccessToken,
      })
      .where('id = :id', { id: user.id as string | number })
      .execute();

    if (updateResult.affected === 0) {
      throw new UnauthorizedException('Failed to update session');
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.removeSensitiveData(user),
    };
  }

  private getOtpOptions(): AuthOtpOptions {
    if (!this.options.otp?.enabled) {
      throw new BadRequestException('OTP login is not enabled');
    }

    if (!this.options.otp.deliverCode) {
      throw new BadRequestException('OTP delivery callback is not configured');
    }

    return this.options.otp;
  }

  private resolveOtpOptions(otp: AuthOtpOptions): ResolvedOtpOptions {
    const codeLength = otp.codeLength ?? 6;
    if (codeLength < 4 || codeLength > 10) {
      throw new BadRequestException('OTP code length must be between 4 and 10');
    }

    return {
      codeLength,
      ttlSeconds: otp.ttlSeconds ?? 300,
      cooldownSeconds: otp.cooldownSeconds ?? 60,
      maxAttempts: otp.maxAttempts ?? 5,
      lockSeconds: otp.lockSeconds ?? 300,
      channel: otp.channel ?? 'email',
      codeField: otp.codeField ?? 'otpCodeHash',
      expiresAtField: otp.expiresAtField ?? 'otpCodeExpiresAt',
      attemptsField: otp.attemptsField ?? 'otpRequestAttempts',
      lastSentAtField: otp.lastSentAtField ?? 'otpLastSentAt',
      lockUntilField: otp.lockUntilField ?? 'otpLockedUntil',
      inputCodeField: otp.inputCodeField ?? 'otpCode',
    };
  }

  private getPasswordResetOptions(): AuthPasswordResetOptions {
    if (!this.options.passwordReset?.enabled) {
      throw new BadRequestException('Password reset is not enabled');
    }

    if (!this.options.passwordReset.deliverToken) {
      throw new BadRequestException(
        'Password reset delivery callback is not configured'
      );
    }

    return this.options.passwordReset;
  }

  private resolvePasswordResetOptions(
    config: AuthPasswordResetOptions
  ): ResolvedPasswordResetOptions {
    return {
      tokenLength: config.tokenLength ?? 64,
      tokenTtlSeconds: config.tokenTtlSeconds ?? 3600,
      tokenField: config.tokenField ?? 'passwordResetTokenHash',
      expiresAtField: config.expiresAtField ?? 'passwordResetTokenExpiresAt',
      cooldownSeconds: config.cooldownSeconds ?? 60,
      maxAttempts: config.maxAttempts ?? 5,
      lockSeconds: config.lockSeconds ?? 300,
      attemptsField: config.attemptsField ?? 'passwordResetAttempts',
      lockUntilField: config.lockUntilField ?? 'passwordResetLockedUntil',
      lastRequestAtField:
        config.lastRequestAtField ?? 'passwordResetLastRequestedAt',
    };
  }

  // ── Login Attempt Helpers ──────────────────────────────────────

  private getLoginAttemptOptions(): ResolvedLoginAttemptOptions {
    const config = this.options.loginAttempts ?? {};
    return {
      enabled: config.enabled ?? true,
      maxAttempts: config.maxAttempts ?? 5,
      lockSeconds: config.lockSeconds ?? 300,
      attemptsField: config.attemptsField ?? 'loginAttempts',
      lockUntilField: config.lockUntilField ?? 'loginLockedUntil',
    };
  }

  private async updateLoginState(
    userId: string | number,
    state: Record<string, unknown>
  ): Promise<void> {
    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set(state)
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  private async updatePasswordResetState(
    userId: string | number,
    state: Record<string, unknown>
  ): Promise<void> {
    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set(state)
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      throw new InternalServerErrorException('Failed to update reset state');
    }
  }

  private async recordFailedPasswordReset(
    userId: string | number,
    user: Record<string, unknown>,
    config: ResolvedPasswordResetOptions,
    now: Date
  ): Promise<void> {
    const currentAttempts = this.toNumber(user[config.attemptsField]);
    const nextAttempts = currentAttempts + 1;

    const updatePayload: Record<string, unknown> = {
      [config.attemptsField]: nextAttempts,
    };

    if (nextAttempts >= config.maxAttempts) {
      updatePayload[config.lockUntilField] = new Date(
        now.getTime() + config.lockSeconds * 1000
      );
    }

    await this.updatePasswordResetState(userId, updatePayload);
  }

  // ── Onboarding Helpers ─────────────────────────────────────────

  private getOnboardingOptions(): AuthOnboardingOptions {
    if (!this.options.onboarding?.enabled) {
      throw new BadRequestException('Assisted onboarding is not enabled');
    }

    if (!this.options.onboarding.deliverCode) {
      throw new BadRequestException(
        'Onboarding delivery callback is not configured'
      );
    }

    return this.options.onboarding;
  }

  private resolveOnboardingOptions(
    onboarding: AuthOnboardingOptions
  ): ResolvedOnboardingOptions {
    const codeLength = onboarding.codeLength ?? 6;
    if (codeLength < 4 || codeLength > 10) {
      throw new BadRequestException(
        'Onboarding OTP code length must be between 4 and 10'
      );
    }

    return {
      codeLength,
      ttlSeconds: onboarding.ttlSeconds ?? 300,
      cooldownSeconds: onboarding.cooldownSeconds ?? 60,
      maxAttempts: onboarding.maxAttempts ?? 5,
      lockSeconds: onboarding.lockSeconds ?? 300,
      channel: onboarding.channel ?? 'email',
      tokenSecret: onboarding.onboardingTokenSecret || this.options.jwtSecret,
      tokenExpiresIn: onboarding.onboardingTokenExpiresIn ?? '15m',
    };
  }

  private generateOnboardingToken(
    attempt: OnboardingAttemptEntity
  ): string {
    const config = this.resolveOnboardingOptions(this.getOnboardingOptions());

    return this.jwtService.sign(
      {
        sub: attempt.id,
        type: 'onboarding',
        identifierField: attempt.identifierField,
        identifier: attempt.identifier,
      },
      {
        secret: config.tokenSecret,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: config.tokenExpiresIn as any,
      }
    );
  }

  private async updateOnboardingState(
    attemptId: number,
    state: Record<string, unknown>
  ): Promise<void> {
    const result = await this.onboardingAttemptRepository.update(
      attemptId,
      state
    );

    if (result.affected === 0) {
      throw new InternalServerErrorException(
        'Failed to update onboarding state'
      );
    }
  }

  private async clearOnboardingState(attemptId: number): Promise<void> {
    await this.updateOnboardingState(attemptId, {
      codeHash: null,
      codeExpiresAt: null,
      attempts: 0,
      lastSentAt: null,
      lockedUntil: null,
    });
  }

  // ── Verification Helpers ──────────────────────────────────────

  private getVerificationOptions(): AuthVerificationOptions {
    if (!this.options.verification?.enabled) {
      throw new BadRequestException('Account verification is not enabled');
    }

    if (!this.options.verification.deliverCode) {
      throw new BadRequestException(
        'Verification delivery callback is not configured'
      );
    }

    return this.options.verification;
  }

  private resolveVerificationOptions(
    verif: AuthVerificationOptions
  ): ResolvedVerificationOptions {
    const codeLength = verif.codeLength ?? 6;
    if (codeLength < 4 || codeLength > 10) {
      throw new BadRequestException(
        'Verification code length must be between 4 and 10'
      );
    }

    return {
      codeLength,
      ttlSeconds: verif.ttlSeconds ?? 600,
      cooldownSeconds: verif.cooldownSeconds ?? 60,
      maxAttempts: verif.maxAttempts ?? 5,
      lockSeconds: verif.lockSeconds ?? 300,
      channel: verif.channel ?? 'email',
      verifiedField: verif.verifiedField ?? 'isVerified',
      verifiedAtField: verif.verifiedAtField ?? 'verifiedAt',
      codeHashField: verif.codeHashField ?? 'verificationCodeHash',
      expiresAtField: verif.expiresAtField ?? 'verificationCodeExpiresAt',
      attemptsField: verif.attemptsField ?? 'verificationAttempts',
      lastSentAtField: verif.lastSentAtField ?? 'verificationLastSentAt',
      lockUntilField: verif.lockUntilField ?? 'verificationLockedUntil',
      inputCodeField: verif.inputCodeField ?? 'code',
    };
  }

  private async generateAndSendVerificationOtp(
    userId: string | number,
    identifier: string
  ): Promise<void> {
    const verifOptions = this.getVerificationOptions();
    const verif = this.resolveVerificationOptions(verifOptions);

    const code = this.generateOtpCode(verif.codeLength);
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + verif.ttlSeconds * 1000);

    await this.updateVerificationState(userId, verif, {
      [verif.codeHashField]: hashedCode,
      [verif.expiresAtField]: expiresAt,
      [verif.attemptsField]: 0,
      [verif.lastSentAtField]: new Date(),
      [verif.lockUntilField]: null,
    });

    await verifOptions.deliverCode!({
      identifier,
      code,
      channel: verifOptions.channel ?? verif.channel,
      expiresAt,
    });
  }

  private async updateVerificationState(
    userId: string | number,
    verif: ResolvedVerificationOptions,
    state: Record<string, unknown>
  ): Promise<void> {
    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set(state)
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      throw new InternalServerErrorException('Failed to update verification state');
    }
  }

  async verifyAccount(data: Record<string, unknown>): Promise<AuthTokens> {
    const verifOptions = this.getVerificationOptions();
    const verif = this.resolveVerificationOptions(verifOptions);

    const presentIdentifiers = this.getPresentIdentifiers(data);
    const code = data[verif.inputCodeField];

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    if (typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException(`${verif.inputCodeField} is required`);
    }

    const normalizedIdentifier = presentIdentifiers[0].value.trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${this.options.passkeyField}`)
      .addSelect(`user.${verif.codeHashField}`)
      .addSelect(`user.${verif.expiresAtField}`)
      .addSelect(`user.${verif.attemptsField}`)
      .addSelect(`user.${verif.lockUntilField}`)
      .where(this.buildIdentifierOrCondition('user'), {
        identifier: normalizedIdentifier,
      })
      .getOne();

    if (!user) {
      this.emitAuthEvent('auth.verification.verify.failed.user_not_found', {
        metadata: { identifier: normalizedIdentifier },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    const now = new Date();

    // Check lock
    const lockUntil = this.toDate(user[verif.lockUntilField]);
    if (lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.verification.verify.failed.locked', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });
      throw new BadRequestException('Too many verification attempts');
    }

    const storedHash = user[verif.codeHashField] as string | null;
    const expiresAt = this.toDate(user[verif.expiresAtField]);

    if (!storedHash || !expiresAt) {
      this.emitAuthEvent('auth.verification.verify.failed.not_requested', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });
      throw new UnauthorizedException('No verification code has been sent');
    }

    // Check expiry → delete user
    if (expiresAt <= now) {
      await this.userRepository.delete(user.id as string | number);
      this.emitAuthEvent('auth.verification.verify.failed.expired', {
        metadata: { identifier: normalizedIdentifier },
      });
      throw new UnauthorizedException(
        'Verification code has expired. Please register again.'
      );
    }

    const isCodeValid = await bcrypt.compare(code.trim(), storedHash);

    if (!isCodeValid) {
      const currentAttempts = this.toNumber(user[verif.attemptsField]);
      const nextAttempts = currentAttempts + 1;

      const updatePayload: Record<string, unknown> = {
        [verif.attemptsField]: nextAttempts,
      };

      if (nextAttempts >= verif.maxAttempts) {
        // Max attempts reached → delete user
        await this.userRepository.delete(user.id as string | number);
        this.emitAuthEvent('auth.verification.verify.failed.max_attempts', {
          metadata: { identifier: normalizedIdentifier },
        });
        throw new UnauthorizedException(
          'Maximum verification attempts reached. Please register again.'
        );
      }

      await this.updateVerificationState(user.id as string | number, verif, updatePayload);

      this.emitAuthEvent('auth.verification.verify.failed.invalid', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier, attemptsRemaining: verif.maxAttempts - nextAttempts },
      });
      throw new UnauthorizedException({
        code: 'VERIFICATION_INVALID',
        message: 'Invalid verification code',
        attemptsRemaining: verif.maxAttempts - nextAttempts,
      });
    }

    // Success — clear verification state, mark verified, issue tokens
    await this.updateVerificationState(user.id as string | number, verif, {
      [verif.codeHashField]: null,
      [verif.expiresAtField]: null,
      [verif.attemptsField]: 0,
      [verif.lastSentAtField]: null,
      [verif.lockUntilField]: null,
      [verif.verifiedField]: true,
      [verif.verifiedAtField]: new Date(),
    });

    this.emitAuthEvent('auth.verification.verify.success', {
      entityId: user.id,
      userId: user.id,
      metadata: { identifier: normalizedIdentifier },
    });

    return this.generateTokens(user);
  }

  async resendVerificationCode(
    data: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> {
    const verifOptions = this.getVerificationOptions();
    const verif = this.resolveVerificationOptions(verifOptions);

    const presentIdentifiers = this.getPresentIdentifiers(data);

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    const normalizedIdentifier = presentIdentifiers[0].value.trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${verif.lastSentAtField}`)
      .addSelect(`user.${verif.lockUntilField}`)
      .where(this.buildIdentifierOrCondition('user'), {
        identifier: normalizedIdentifier,
      })
      .getOne();

    if (!user) {
      this.emitAuthEvent('auth.verification.resend.failed.user_not_found', {
        metadata: { identifier: normalizedIdentifier },
      });
      return {
        success: true,
        message: 'Verification code has been sent if the account exists',
      };
    }

    const now = new Date();

    // Cooldown
    const lastSentAt = this.toDate(user[verif.lastSentAtField]);
    if (
      lastSentAt &&
      now.getTime() - lastSentAt.getTime() < verif.cooldownSeconds * 1000
    ) {
      this.emitAuthEvent('auth.verification.resend.failed.cooldown', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier: normalizedIdentifier },
      });
      return { success: false, message: 'Resend request is on cooldown' };
    }

    try {
      await this.generateAndSendVerificationOtp(
        user.id as string | number,
        normalizedIdentifier
      );
    } catch {
      this.emitAuthEvent('auth.verification.resend.failed.delivery', {
        entityId: user.id,
        userId: user.id,
      });
      throw new InternalServerErrorException('Failed to deliver verification code');
    }

    this.emitAuthEvent('auth.verification.resend.success', {
      entityId: user.id,
      userId: user.id,
      metadata: { identifier: normalizedIdentifier },
    });

    return { success: true };
  }

  // ── Assisted Onboarding ─────────────────────────────────────────

  /**
   * Agent-initiated step. Creates (or refreshes) a pending onboarding attempt
   * and delivers an OTP to the invitee's identifier. Does not create a user.
   */
  async startOnboarding(
    data: Record<string, unknown>
  ): Promise<{ success: boolean; attemptId?: number; message?: string }> {
    const onboardingOptions = this.getOnboardingOptions();
    const config = this.resolveOnboardingOptions(onboardingOptions);

    const presentIdentifiers = this.getPresentIdentifiers(data);
    if (presentIdentifiers.length === 0) {
      throw new BadRequestException(
        `${this.getIdentifierLabel()} is required`
      );
    }

    const { field, value } = presentIdentifiers[0];
    const identifier = value.trim();

    const existingUser = await this.userRepository.findOne({
      where: { [field]: identifier } as never,
    });

    if (existingUser) {
      this.emitAuthEvent('auth.onboarding.start.failed.user_exists', {
        metadata: { identifier },
      });
      throw new ConflictException('User already exists');
    }

    const now = new Date();

    let attempt = await this.onboardingAttemptRepository.findOne({
      where: {
        identifierField: field,
        identifier,
        consumedAt: IsNull(),
      } as never,
    });

    const lockUntil = this.toDate(attempt?.lockedUntil);
    if (attempt && lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.onboarding.start.locked', {
        metadata: { identifier, attemptId: attempt.id },
      });
      return {
        success: false,
        message:
          'Onboarding OTP requests are temporarily locked due to multiple failed attempts',
      };
    }

    const lastSentAt = this.toDate(attempt?.lastSentAt);
    if (
      attempt &&
      lastSentAt &&
      now.getTime() - lastSentAt.getTime() < config.cooldownSeconds * 1000
    ) {
      this.emitAuthEvent('auth.onboarding.start.cooldown', {
        metadata: { identifier, attemptId: attempt.id },
      });
      return { success: false, message: 'Onboarding OTP request is on cooldown' };
    }

    const code = this.generateOtpCode(config.codeLength);
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(now.getTime() + config.ttlSeconds * 1000);

    let isNewAttempt = false;
    if (!attempt) {
      attempt = this.onboardingAttemptRepository.create({
        identifierField: field,
        identifier,
        attempts: 0,
      });
      attempt = await this.onboardingAttemptRepository.save(attempt);
      isNewAttempt = true;
    }

    await this.updateOnboardingState(attempt.id, {
      codeHash: hashedCode,
      codeExpiresAt: expiresAt,
      attempts: 0,
      lastSentAt: now,
      lockedUntil: null,
    });

    try {
      await onboardingOptions.deliverCode!({
        identifier,
        code,
        channel: onboardingOptions.channel ?? config.channel,
        expiresAt,
        metadata: onboardingOptions.metadata,
        context: onboardingOptions.buildDeliveryContext?.({ identifier }),
      });
    } catch {
      if (isNewAttempt) {
        await this.onboardingAttemptRepository.delete(attempt.id);
      } else {
        await this.clearOnboardingState(attempt.id);
      }
      this.emitAuthEvent('auth.onboarding.start.failed.delivery', {
        metadata: { identifier, channel: onboardingOptions.channel ?? config.channel },
      });
      throw new InternalServerErrorException('Failed to deliver onboarding code');
    }

    this.emitAuthEvent('auth.onboarding.start.success', {
      metadata: { identifier, attemptId: attempt.id },
    });
    return { success: true, attemptId: attempt.id };
  }

  /**
   * Agent-initiated step. Validates the OTP the invitee read back, then
   * issues a one-purpose onboarding JWT that only guards the user-creation
   * endpoint.
   */
  async completeOnboarding(
    data: Record<string, unknown>
  ): Promise<{ onboarding_token: string }> {
    const onboardingOptions = this.getOnboardingOptions();
    const config = this.resolveOnboardingOptions(onboardingOptions);
    const inputCodeField = 'code';

    const presentIdentifiers = this.getPresentIdentifiers(data);
    const code = data[inputCodeField];

    if (presentIdentifiers.length === 0) {
      throw new BadRequestException({
        code: 'IDENTIFIER_REQUIRED',
        message: `${this.getIdentifierLabel()} is required`,
      });
    }

    if (typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: `${inputCodeField} is required`,
      });
    }

    const normalizedCode = code.trim();

    const conditions = presentIdentifiers.map(
      ({ field: f, value: v }) =>
        `(oa.identifierField = :field_${f} AND oa.identifier = :val_${f} AND oa.consumedAt IS NULL)`
    );
    const params: Record<string, unknown> = {};
    for (const { field: f, value: v } of presentIdentifiers) {
      params[`field_${f}`] = f;
      params[`val_${f}`] = v.trim();
    }

    const attempt = await this.onboardingAttemptRepository
      .createQueryBuilder('oa')
      .addSelect('oa.codeHash')
      .addSelect('oa.codeExpiresAt')
      .addSelect('oa.attempts')
      .addSelect('oa.lastSentAt')
      .addSelect('oa.lockedUntil')
      .where(`(${conditions.join(' OR ')})`, params)
      .getOne();

    if (!attempt) {
      this.emitAuthEvent('auth.onboarding.complete.failed.not_found', {
        metadata: {
          identifiers: presentIdentifiers.map(({ value: v }) => v),
        },
      });
      throw new UnauthorizedException('Invalid onboarding code');
    }

    const now = new Date();

    const lockUntil = this.toDate(attempt.lockedUntil);
    if (lockUntil && lockUntil > now) {
      this.emitAuthEvent('auth.onboarding.complete.failed.locked', {
        metadata: { attemptId: attempt.id },
      });
      throw new BadRequestException('Too many onboarding OTP attempts');
    }

    const storedHash = attempt.codeHash as string | null;
    const expiresAt = this.toDate(attempt.codeExpiresAt);

    if (!storedHash || !expiresAt) {
      this.emitAuthEvent('auth.onboarding.complete.failed.not_requested', {
        metadata: { attemptId: attempt.id },
      });
      throw new UnauthorizedException('No onboarding code has been generated');
    }

    if (expiresAt <= now) {
      await this.clearOnboardingState(attempt.id);
      this.emitAuthEvent('auth.onboarding.complete.failed.expired', {
        metadata: { attemptId: attempt.id },
      });
      throw new UnauthorizedException(
        'Onboarding code has expired. Please start again.'
      );
    }

    const isCodeValid = await bcrypt.compare(normalizedCode, storedHash);

    if (!isCodeValid) {
      const currentAttempts = this.toNumber(attempt.attempts);
      const nextAttempts = currentAttempts + 1;

      const updatePayload: Record<string, unknown> = {
        attempts: nextAttempts,
      };

      if (nextAttempts >= config.maxAttempts) {
        updatePayload.lockedUntil = new Date(
          now.getTime() + config.lockSeconds * 1000
        );
        await this.updateOnboardingState(attempt.id, updatePayload);
        this.emitAuthEvent('auth.onboarding.complete.failed.max_attempts', {
          metadata: { attemptId: attempt.id, lockUntil: updatePayload.lockedUntil },
        });
        throw new BadRequestException('Maximum onboarding attempts reached');
      }

      await this.updateOnboardingState(attempt.id, updatePayload);
      this.emitAuthEvent('auth.onboarding.complete.failed.invalid', {
        metadata: { attemptId: attempt.id, attemptsRemaining: config.maxAttempts - nextAttempts },
      });
      throw new UnauthorizedException({
        code: 'ONBOARDING_INVALID',
        message: 'Invalid onboarding code',
        attemptsRemaining: config.maxAttempts - nextAttempts,
      });
    }

    // Clear OTP state but keep the attempt pending so the token stays valid.
    await this.clearOnboardingState(attempt.id);

    const onboarding_token = this.generateOnboardingToken(attempt);

    this.emitAuthEvent('auth.onboarding.complete.success', {
      metadata: { attemptId: attempt.id, identifier: attempt.identifier },
    });

    return { onboarding_token };
  }

  /**
   * Token-guarded step. Creates the user for the identifier bound to the
   * onboarding attempt, reusing the same `registerHooks` transaction as
   * `register()`. No password is set; the attempt is consumed (single use).
   */
  async createUserFromOnboarding(
    attempt: OnboardingAttemptEntity,
    data: Record<string, unknown>
  ): Promise<AuthUser> {
    if (!this.options.onboarding?.enabled) {
      throw new BadRequestException('Onboarding is not enabled');
    }

    const field = attempt.identifierField;
    const identifier = attempt.identifier;

    const provided = data[field];
    if (
      provided !== undefined &&
      provided !== null &&
      String(provided).trim() !== identifier
    ) {
      throw new BadRequestException(`Identifier mismatch for ${field}`);
    }

    const userData: Record<string, unknown> = {
      ...data,
      [field]: identifier,
    };
    delete userData[this.options.passkeyField];

    const verificationEnabled = this.options.verification?.enabled;

    const savedUser = await this.createUserWithHooks(userData, {
      hashedPassword: undefined,
      ...(verificationEnabled
        ? { verified: true, verifiedAt: new Date() }
        : {}),
      onSaved: async (manager) => {
        await manager
          .getRepository(OnboardingAttemptEntity)
          .update(attempt.id, { consumedAt: new Date() });
      },
    });

    this.emitAuthEvent('auth.onboarding.user.create.success', {
      entityId: savedUser.id,
      userId: savedUser.id,
      metadata: { attemptId: attempt.id, identifier },
    });

    return this.removeSensitiveData(savedUser);
  }

  private async clearPasswordResetState(
    userId: string | number,
    config: ResolvedPasswordResetOptions
  ): Promise<void> {
    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set({
        [config.tokenField]: null,
        [config.expiresAtField]: null,
      })
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      throw new InternalServerErrorException('Failed to clear reset state');
    }
  }

  private generateOtpCode(length: number): string {
    const max = 10 ** length;
    return crypto.randomInt(0, max).toString().padStart(length, '0');
  }

  private toDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    const dateValue = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(dateValue.getTime())) {
      return null;
    }

    return dateValue;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private async updateOtpState(
    userId: string | number,
    state: Record<string, unknown>
  ): Promise<void> {
    const updateResult = await this.userRepository
      .createQueryBuilder()
      .update(this.options.userEntity)
      .set(state)
      .where('id = :id', { id: userId })
      .execute();

    if (updateResult.affected === 0) {
      throw new UnauthorizedException('Failed to update OTP session');
    }
  }

  private async clearOtpState(
    userId: string | number,
    otpConfig: ResolvedOtpOptions
  ): Promise<void> {
    await this.updateOtpState(userId, {
      [otpConfig.codeField]: null,
      [otpConfig.expiresAtField]: null,
      [otpConfig.attemptsField]: 0,
      [otpConfig.lastSentAtField]: null,
      [otpConfig.lockUntilField]: null,
    });
  }

  private removeSensitiveData(user: Record<string, unknown>): AuthUser {
    const { ...userData } = user;
    const passkeyField = this.options.passkeyField;
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const accessTokenField = this.options.accessTokenField || 'accessToken';

    delete userData[passkeyField];
    delete userData[refreshTokenField];
    delete userData[accessTokenField];

    if (this.options.loginAttempts) {
      const loginConfig = this.getLoginAttemptOptions();
      delete userData[loginConfig.attemptsField];
      delete userData[loginConfig.lockUntilField];
    }

    if (this.options.otp?.enabled) {
      const otpConfig = this.resolveOtpOptions(this.options.otp);
      delete userData[otpConfig.codeField];
      delete userData[otpConfig.expiresAtField];
      delete userData[otpConfig.attemptsField];
      delete userData[otpConfig.lastSentAtField];
      delete userData[otpConfig.lockUntilField];
    }

    if (this.options.verification?.enabled) {
      const verif = this.resolveVerificationOptions(this.options.verification);
      delete userData[verif.codeHashField];
      delete userData[verif.expiresAtField];
      delete userData[verif.attemptsField];
      delete userData[verif.lastSentAtField];
      delete userData[verif.lockUntilField];
    }

    if (this.options.passwordReset?.enabled) {
      const resetConfig = this.resolvePasswordResetOptions(
        this.options.passwordReset
      );
      delete userData[resetConfig.tokenField];
      delete userData[resetConfig.expiresAtField];
      delete userData[resetConfig.attemptsField];
      delete userData[resetConfig.lockUntilField];
      delete userData[resetConfig.lastRequestAtField];
    }

    return userData as AuthUser;
  }

  async validateUser(payload: {
    sub: string | number;
    nonce: string;
  }): Promise<AuthUser | null> {
    const accessTokenField = this.options.accessTokenField || 'accessToken';

    const query = this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${accessTokenField}`)
      .where('user.id = :id', { id: payload.sub });

    const relations = new Set(this.options.relations ?? []);
    if (this.options.rbac?.userRolesRelation) {
      relations.add(this.options.rbac.userRolesRelation);
    }

    if (relations.size > 0) {
      const joinedAliases = new Set<string>();

      relations.forEach((relation) => {
        const segments = relation.split('.');
        let parentAlias = 'user';
        let currentPath = '';

        segments.forEach((segment) => {
          currentPath = currentPath ? `${currentPath}.${segment}` : segment;
          const alias = currentPath.replace(/\./g, '_');
          if (!joinedAliases.has(alias)) {
            query.leftJoinAndSelect(`${parentAlias}.${segment}`, alias);
            joinedAliases.add(alias);
          }
          parentAlias = alias;
        });
      });
    }

    const user = await query.getOne();

    const storedAccessToken = user ? user[accessTokenField] : null;

    if (!user || !storedAccessToken) {
      throw new UnauthorizedException('Access token reused or invalid');
    }

    const isAccessTokenValid = await bcrypt.compare(
      payload.nonce,
      storedAccessToken as string
    );
    if (!isAccessTokenValid) {
      throw new UnauthorizedException('Access token reused or invalid');
    }

    if (this.options.verification?.enabled) {
      const verifiedField = this.options.verification.verifiedField ?? 'isVerified';
      if (!user[verifiedField]) {
        throw new UnauthorizedException('Account not verified');
      }
    }

    return this.removeSensitiveData(user);
  }

  private async createUserWithHooks(
    data: Record<string, unknown>,
    config: CreateUserConfig
  ): Promise<Record<string, unknown>> {
    const hooks = this.options.registerHooks;
    const verifiedField = this.options.verification?.verifiedField ?? 'isVerified';
    const verifiedAtField = this.options.verification?.verifiedAtField ?? 'verifiedAt';

    return await this.dataSource.transaction(async (manager) => {
      if (hooks?.beforeRegister) {
        await hooks.beforeRegister({ payload: data, manager });
      }

      const userRepository = manager.getRepository(this.options.userEntity);

      const columns: Record<string, unknown> = {
        ...data,
        [this.options.passkeyField]: config.hashedPassword,
      };

      if (config.verified !== undefined) {
        columns[verifiedField] = config.verified;
      }
      if (config.verifiedAt !== undefined) {
        columns[verifiedAtField] = config.verifiedAt;
      }

      const newUser = userRepository.create(columns);

      const saved = await userRepository.save(newUser);

      if (hooks?.afterRegister) {
        const userId = (saved as Record<string, unknown>).id as string | number;
        await hooks.afterRegister({
          payload: data,
          entity: saved,
          userId,
          manager,
          assignRole: this.makeAssignRole(manager, userId),
        });
      }

      if (config.onSaved) {
        await config.onSaved(manager, saved as Record<string, unknown>);
      }

      return saved as Record<string, unknown>;
    });
  }

  private async assertUserExists(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId } as never,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private makeAssignRole(
    manager: EntityManager,
    userId: string | number
  ): (roleIdOrName: string | number) => Promise<void> {
    const roleRepository = manager.getRepository(RoleEntity);
    const userRoleRepository = manager.getRepository(UserRoleEntity);

    return async (roleIdOrName: string | number) => {
      const role =
        typeof roleIdOrName === 'number'
          ? await roleRepository.findOne({ where: { id: roleIdOrName } })
          : await roleRepository.findOne({ where: { name: roleIdOrName } });

      if (!role) {
        throw new NotFoundException(`Role '${roleIdOrName}' not found`);
      }

      const assignment = userRoleRepository.create({
        userId: userId as number,
        roleId: role.id,
      });
      await userRoleRepository.save(assignment);
    };
  }

  private toPermissionArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const permissions = value
      .filter(
        (permission): permission is string =>
          typeof permission === 'string' && permission.trim().length > 0
      )
      .map((permission) => permission.trim());

    return [...new Set(permissions)];
  }
}
