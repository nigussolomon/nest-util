import { keyed, ErrorKey } from '@nest-util/nest-error';
import {
  Inject,
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { ApiKeyRoleEntity } from '../entities/api-key-role.entity';
import { RoleEntity } from '../entities/role.entity';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { AuthUser } from '../interfaces/user.interface';
import { resolvePermissions } from '../helpers/permission.helper';

const DEFAULT_KEY_PREFIX = 'nuk_live_';
const DEFAULT_HASH_ROUNDS = 10;

export interface CreatedApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  roles?: { id: number; name: string; permissions?: string[] }[];
}

@Injectable()
export class ApiKeyService {
  private readonly keyPrefix: string;
  private readonly hashRounds: number;

  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiKeyRoleEntity)
    private readonly apiKeyRoleRepo: Repository<ApiKeyRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions
  ) {
    const apiKeyOpts = this.options.apiKey;
    this.keyPrefix = apiKeyOpts?.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.hashRounds = apiKeyOpts?.hashRounds ?? DEFAULT_HASH_ROUNDS;
  }

  async create(
    userId: number,
    data: { name: string; roleIds?: number[]; expiresAt?: string }
  ): Promise<CreatedApiKey> {
    const rawKey = this.generateKey();
    const keyHash = await bcrypt.hash(rawKey, this.hashRounds);
    const keyPrefix = rawKey.substring(0, this.keyPrefix.length + 8);

    const apiKey = this.apiKeyRepo.create({
      userId,
      name: data.name,
      keyHash,
      keyPrefix,
      isActive: true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });

    const saved = await this.apiKeyRepo.save(apiKey);

    if (data.roleIds?.length) {
      const roles = await this.roleRepo.findBy({ id: In(data.roleIds) });
      if (roles.length !== data.roleIds.length) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.AUTH_API_KEY_ROLE_NOT_FOUND);
      }
      const apiKeyRoles = data.roleIds.map((roleId) =>
        this.apiKeyRoleRepo.create({ apiKeyId: saved.id, roleId })
      );
      await this.apiKeyRoleRepo.save(apiKeyRoles);
    }

    return {
      id: saved.id,
      name: saved.name,
      key: rawKey,
      keyPrefix: saved.keyPrefix,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  async list(userId: number): Promise<ApiKeyListItem[]> {
    const keys = await this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const apiKeyIds = keys.map((k) => k.id);
    const apiKeyRoles = apiKeyIds.length
      ? await this.apiKeyRoleRepo.find({
          where: { apiKeyId: In(apiKeyIds) },
        })
      : [];

    const roleIds = [...new Set(apiKeyRoles.map((kr) => kr.roleId))];
    const roles = roleIds.length
      ? await this.roleRepo.findBy({ id: In(roleIds) })
      : [];
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    const rolesByKeyId = new Map<
      string,
      { id: number; name: string; permissions?: string[] }[]
    >();
    for (const kr of apiKeyRoles) {
      const role = roleMap.get(kr.roleId);
      if (!role) continue;
      const list = rolesByKeyId.get(kr.apiKeyId) ?? [];
      list.push({ id: role.id, name: role.name, permissions: role.permissions });
      rolesByKeyId.set(kr.apiKeyId, list);
    }

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
      roles: rolesByKeyId.get(k.id),
    }));
  }

  async revoke(userId: number, keyId: string): Promise<boolean> {
    const key = await this.apiKeyRepo.findOneBy({ id: keyId, userId });
    if (!key) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.AUTH_API_KEY_NOT_FOUND);
    }
    key.isActive = false;
    await this.apiKeyRepo.save(key);
    return true;
  }

  async validate(rawKey: string): Promise<{
    user: AuthUser;
    apiKey: ApiKeyEntity;
  }> {
    if (!rawKey) {
      throw keyed(HttpStatus.UNAUTHORIZED, ErrorKey.AUTH_API_KEY_MISSING);
    }

    const allKeys = await this.apiKeyRepo
      .createQueryBuilder('k')
      .addSelect('k.keyHash')
      .getMany();

    let matchedKey: ApiKeyEntity | null = null;
    for (const key of allKeys) {
      if (await bcrypt.compare(rawKey, key.keyHash)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      throw keyed(HttpStatus.UNAUTHORIZED, ErrorKey.AUTH_API_KEY_INVALID);
    }

    if (!matchedKey.isActive) {
      throw keyed(HttpStatus.UNAUTHORIZED, ErrorKey.AUTH_API_KEY_REVOKED);
    }

    if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
      throw keyed(HttpStatus.UNAUTHORIZED, ErrorKey.AUTH_API_KEY_EXPIRED);
    }

    const apiKeyRoles = await this.apiKeyRoleRepo.find({
      where: { apiKeyId: matchedKey.id },
    });

    const roleIds = apiKeyRoles.map((kr) => kr.roleId);
    const roles = roleIds.length
      ? await this.roleRepo.findBy({ id: In(roleIds) })
      : [];

    const roleLikeObjects = roles.map((role) => ({
      role,
      permissions: role.permissions,
    }));

    const rolesKey = this.options.rbac?.rolesKey ?? 'roles';

    const user: AuthUser = {
      id: matchedKey.userId,
      [rolesKey]: roleLikeObjects,
      permissions: resolvePermissions(
        { id: matchedKey.userId, [rolesKey]: roleLikeObjects } as unknown as AuthUser,
        this.options.rbac
      ),
      apiKeyId: matchedKey.id,
    };

    matchedKey.lastUsedAt = new Date();
    await this.apiKeyRepo.save(matchedKey);

    return { user, apiKey: matchedKey };
  }

  async assignRole(
    userId: number,
    keyId: string,
    roleId: number
  ): Promise<ApiKeyRoleEntity> {
    const key = await this.apiKeyRepo.findOneBy({ id: keyId, userId });
    if (!key) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.AUTH_API_KEY_NOT_FOUND);
    }

    const role = await this.roleRepo.findOneBy({ id: roleId });
    if (!role) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.AUTH_ROLE_NOT_FOUND);
    }

    const existing = await this.apiKeyRoleRepo.findOneBy({
      apiKeyId: keyId,
      roleId,
    });
    if (existing) {
      throw keyed(HttpStatus.CONFLICT, ErrorKey.AUTH_API_KEY_ROLE_ASSIGN_FAILED);
    }

    const apiKeyRole = this.apiKeyRoleRepo.create({
      apiKeyId: keyId,
      roleId,
    });
    return await this.apiKeyRoleRepo.save(apiKeyRole);
  }

  async removeRole(
    userId: number,
    keyId: string,
    roleId: number
  ): Promise<boolean> {
    const key = await this.apiKeyRepo.findOneBy({ id: keyId, userId });
    if (!key) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.AUTH_API_KEY_NOT_FOUND);
    }

    const result = await this.apiKeyRoleRepo.delete({
      apiKeyId: keyId,
      roleId,
    });
    return (result.affected ?? 0) > 0;
  }

  private generateKey(): string {
    const randomBytes = crypto.randomBytes(24).toString('base64url');
    return `${this.keyPrefix}${randomBytes}`;
  }
}
