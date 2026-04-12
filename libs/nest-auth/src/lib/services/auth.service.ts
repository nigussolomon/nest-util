import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { AuthUser, AuthTokens } from '../interfaces/user.interface';
import { RoleEntity } from '../entities/role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { CreateRoleDto } from '../dtos/create-role.dto';

@Injectable()
export class AuthService {
  private readonly userRepository: Repository<Record<string, unknown>>;
  private readonly roleRepository: Repository<RoleEntity>;
  private readonly userRoleRepository: Repository<UserRoleEntity>;

  constructor(
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
    private readonly jwtService: JwtService,
    @Inject(DataSource) private readonly dataSource: DataSource
  ) {
    this.userRepository = this.dataSource.getRepository(
      this.options.userEntity
    ) as Repository<Record<string, unknown>>;
    this.roleRepository = this.dataSource.getRepository(RoleEntity);
    this.userRoleRepository = this.dataSource.getRepository(UserRoleEntity);
  }

  async register(data: Record<string, unknown>): Promise<AuthUser> {
    const identifier = data[this.options.identifierField] as string;
    const password = data[this.options.passkeyField] as string;

    const existingUser = await this.userRepository.findOne({
      where: { [this.options.identifierField]: identifier },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = this.userRepository.create({
      ...data,
      [this.options.passkeyField]: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user[this.options.passkeyField] as string
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return await this.generateTokens(user);
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
        throw new UnauthorizedException('Invalid refresh token');
      }

      const storedHash = user[refreshTokenField] as string;
      if (!storedHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenValid = await bcrypt.compare(payload.nonce, storedHash);
      if (!isTokenValid) {
        throw new UnauthorizedException('Refresh token reused or invalid');
      }

      return await this.generateTokens(user);
    } catch (e: unknown) {
      if (e instanceof UnauthorizedException) throw e;
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
      throw new UnauthorizedException('Failed to logout');
    }

    return true;
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

    return await this.roleRepository.save(role);
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
    return await this.roleRepository.save(role);
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

    return await this.roleRepository.save(role);
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
    await this.assertUserExists(userId);

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const result = await this.userRoleRepository.delete({ userId, roleId });
    return (result.affected ?? 0) > 0;
  }

  async getUserRoles(userId: number): Promise<RoleEntity[]> {
    await this.assertUserExists(userId);

    const assignments = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
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

  private removeSensitiveData(user: Record<string, unknown>): AuthUser {
    const { ...userData } = user;
    const passkeyField = this.options.passkeyField;
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const accessTokenField = this.options.accessTokenField || 'accessToken';

    delete userData[passkeyField];
    delete userData[refreshTokenField];
    delete userData[accessTokenField];

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
