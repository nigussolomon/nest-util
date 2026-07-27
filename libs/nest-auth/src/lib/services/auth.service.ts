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
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUTH_OPTIONS } from '../constants';
import type {
  AuthModuleOptions,
  AuthPasswordResetOptions,
} from '../interfaces/auth-options';
import type { AuthOtpOptions } from '../interfaces/auth-options';
import { AuthUser, AuthTokens } from '../interfaces/user.interface';
import { RoleEntity } from '../entities/role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { CreateRoleDto } from '../dtos/create-role.dto';

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
}

@Injectable()
export class AuthService {
  private readonly userRepository: Repository<Record<string, unknown>>;
  private readonly roleRepository: Repository<RoleEntity>;
  private readonly userRoleRepository: Repository<UserRoleEntity>;

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

  async register(data: Record<string, unknown>): Promise<AuthUser> {
    const identifier = data[this.options.identifierField] as string;
    const password = data[this.options.passkeyField] as string;

    const existingUser = await this.userRepository.findOne({
      where: { [this.options.identifierField]: identifier },
    });

    if (existingUser) {
      this.emitAuthEvent('auth.user.register.conflict', { metadata: { identifier } });
      throw new ConflictException('User already exists');
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;
    const newUser = this.userRepository.create({
      ...data,
      [this.options.passkeyField]: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);
    this.emitAuthEvent('auth.user.register.success', {
      entityId: (savedUser as any).id,
      userId: (savedUser as any).id,
      metadata: { identifier },
    });
    return this.removeSensitiveData(savedUser);
  }

  async login(credentials: Record<string, unknown>): Promise<AuthTokens> {
    const identifier = credentials[this.options.identifierField] as string;
    const password = credentials[this.options.passkeyField] as string;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${this.options.passkeyField}`)
      .where({ [this.options.identifierField]: identifier })
      .getOne();

    if (!user) {
      this.emitAuthEvent('auth.user.login.failed.user_not_found', { metadata: { identifier } });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = user[this.options.passkeyField]
      ? await bcrypt.compare(
          password,
          user[this.options.passkeyField] as string
        )
      : false;

    if (!isPasswordValid) {
      this.emitAuthEvent('auth.user.login.failed.invalid_password', {
        entityId: user.id,
        userId: user.id,
        metadata: { identifier },
      });
      throw new UnauthorizedException('Invalid credentials');
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
    const identifier = data[this.options.identifierField];

    if (typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new BadRequestException(
        `${this.options.identifierField} is required`
      );
    }

    const normalizedIdentifier = identifier.trim();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${otpConfig.codeField}`)
      .addSelect(`user.${otpConfig.expiresAtField}`)
      .addSelect(`user.${otpConfig.attemptsField}`)
      .addSelect(`user.${otpConfig.lastSentAtField}`)
      .addSelect(`user.${otpConfig.lockUntilField}`)
      .where({ [this.options.identifierField]: normalizedIdentifier })
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

    const identifier = credentials[this.options.identifierField];
    const otpCode = credentials[otpConfig.inputCodeField];

    if (typeof identifier !== 'string' || !identifier.trim()) {
      throw new BadRequestException({
        code: 'IDENTIFIER_REQUIRED',
        message: `${this.options.identifierField} is required`,
      });
    }

    if (typeof otpCode !== 'string' || !otpCode.trim()) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: `${otpConfig.inputCodeField} is required`,
      });
    }

    const normalizedIdentifier = identifier.trim();
    const normalizedOtp = otpCode.trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${otpConfig.codeField}`)
      .addSelect(`user.${otpConfig.expiresAtField}`)
      .addSelect(`user.${otpConfig.attemptsField}`)
      .addSelect(`user.${otpConfig.lockUntilField}`)
      .where({ [this.options.identifierField]: normalizedIdentifier })
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

    const identifier = data[this.options.identifierField];

    if (typeof identifier !== 'string' || !identifier.trim()) {
      throw new BadRequestException(
        `${this.options.identifierField} is required`
      );
    }

    const normalizedIdentifier = identifier.trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${resetConfig.tokenField}`)
      .addSelect(`user.${resetConfig.expiresAtField}`)
      .where({
        [this.options.identifierField]: normalizedIdentifier,
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

    const expiresAt = this.toDate(matchedUser[resetConfig.expiresAtField]);

    if (!expiresAt || expiresAt <= now) {
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

  private async generateTokens(
    user: Record<string, unknown>
  ): Promise<AuthTokens> {
    const identifierField = this.options.identifierField;
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const accessTokenField = this.options.accessTokenField || 'accessToken';
    const payload = { sub: user.id, [identifierField]: user[identifierField] };

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
    };
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

    if (this.options.otp?.enabled) {
      const otpConfig = this.resolveOtpOptions(this.options.otp);
      delete userData[otpConfig.codeField];
      delete userData[otpConfig.expiresAtField];
      delete userData[otpConfig.attemptsField];
      delete userData[otpConfig.lastSentAtField];
      delete userData[otpConfig.lockUntilField];
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

    return this.removeSensitiveData(user);
  }

  private async assertUserExists(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId } as never,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
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
