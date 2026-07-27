import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyService } from './api-key.service';
import { AUTH_OPTIONS } from '../constants';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { ApiKeyRoleEntity } from '../entities/api-key-role.entity';
import { RoleEntity } from '../entities/role.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiKeyRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiKeyRoleRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userRepo: any;

  const mockOptions = {
    userEntity: class User {},
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
    apiKey: {
      enabled: true,
      headerName: 'x-api-key',
      keyPrefix: 'nuk_live_',
      hashRounds: 10,
    },
  };

  beforeEach(async () => {
    apiKeyRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      }),
    };

    apiKeyRoleRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      delete: jest.fn(),
    };

    roleRepo = {
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };

    userRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: AUTH_OPTIONS,
          useValue: mockOptions,
        },
        {
          provide: getRepositoryToken(ApiKeyEntity),
          useValue: apiKeyRepo,
        },
        {
          provide: getRepositoryToken(ApiKeyRoleEntity),
          useValue: apiKeyRoleRepo,
        },
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: roleRepo,
        },
        {
          provide: 'UserEntity',
          useValue: userRepo,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an API key and return the raw key', async () => {
      const dto = { name: 'test-key', roleIds: [1, 2] };
      const savedKey = {
        id: 'uuid-1',
        name: 'test-key',
        keyHash: 'hashed',
        keyPrefix: 'nuk_live_abc',
        isActive: true,
        expiresAt: undefined,
        createdAt: new Date(),
        lastUsedAt: undefined,
      };

      apiKeyRepo.create.mockReturnValue(savedKey);
      apiKeyRepo.save.mockResolvedValue(savedKey);
      roleRepo.findBy.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      apiKeyRoleRepo.create.mockImplementation((data: { apiKeyId: string; roleId: number }) => data);
      apiKeyRoleRepo.save.mockResolvedValue([]);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.create(1, dto);

      expect(result.id).toBe('uuid-1');
      expect(result.name).toBe('test-key');
      expect(result.key).toMatch(/^nuk_live_/);
      expect(apiKeyRepo.save).toHaveBeenCalled();
      expect(apiKeyRoleRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ apiKeyId: 'uuid-1', roleId: 1 }),
          expect.objectContaining({ apiKeyId: 'uuid-1', roleId: 2 }),
        ])
      );
    });

    it('should create without roles when roleIds is empty', async () => {
      const dto = { name: 'test-key' };
      const savedKey = {
        id: 'uuid-2',
        name: 'test-key',
        keyHash: 'hashed',
        keyPrefix: 'nuk_live_abc',
        isActive: true,
        createdAt: new Date(),
      };

      apiKeyRepo.create.mockReturnValue(savedKey);
      apiKeyRepo.save.mockResolvedValue(savedKey);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.create(1, dto);

      expect(result.id).toBe('uuid-2');
      expect(apiKeyRoleRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when role not found', async () => {
      const dto = { name: 'test-key', roleIds: [999] };
      const savedKey = {
        id: 'uuid-3',
        name: 'test-key',
        keyHash: 'hashed',
        keyPrefix: 'nuk_live_abc',
        isActive: true,
        createdAt: new Date(),
      };

      apiKeyRepo.create.mockReturnValue(savedKey);
      apiKeyRepo.save.mockResolvedValue(savedKey);
      roleRepo.findBy.mockResolvedValue([]);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.create(1, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should list API keys with roles', async () => {
      const keys = [
        {
          id: 'uuid-1',
          userId: 1,
          name: 'key-1',
          keyPrefix: 'nuk_live_abc',
          isActive: true,
          createdAt: new Date(),
        },
      ];
      const apiKeyRoles = [
        { apiKeyId: 'uuid-1', roleId: 1 },
      ];
      const roles = [
        { id: 1, name: 'admin', permissions: ['admin.access'] },
      ];

      apiKeyRepo.find.mockResolvedValue(keys);
      apiKeyRoleRepo.find.mockResolvedValue(apiKeyRoles);
      roleRepo.findBy.mockResolvedValue(roles);

      const result = await service.list(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('key-1');
      expect(result[0].roles).toEqual([
        { id: 1, name: 'admin', permissions: ['admin.access'] },
      ]);
    });

    it('should list API keys without roles', async () => {
      const keys = [
        {
          id: 'uuid-1',
          userId: 1,
          name: 'key-1',
          keyPrefix: 'nuk_live_abc',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      apiKeyRepo.find.mockResolvedValue(keys);
      apiKeyRoleRepo.find.mockResolvedValue([]);

      const result = await service.list(1);

      expect(result).toHaveLength(1);
      expect(result[0].roles).toBeUndefined();
    });

    it('should return empty array when no keys exist', async () => {
      apiKeyRepo.find.mockResolvedValue([]);

      const result = await service.list(1);

      expect(result).toEqual([]);
    });
  });

  describe('revoke', () => {
    it('should revoke an API key', async () => {
      const key = {
        id: 'uuid-1',
        userId: 1,
        isActive: true,
      };

      apiKeyRepo.findOneBy.mockResolvedValue(key);
      apiKeyRepo.save.mockResolvedValue({ ...key, isActive: false });

      const result = await service.revoke(1, 'uuid-1');

      expect(result).toBe(true);
      expect(key.isActive).toBe(false);
      expect(apiKeyRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyRepo.findOneBy.mockResolvedValue(null);

      await expect(service.revoke(1, 'uuid-999')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('validate', () => {
    it('should validate a valid API key', async () => {
      const rawKey = 'nuk_live_abc123';
      const hashedKey = {
        id: 'uuid-1',
        userId: 1,
        keyHash: 'hashed',
        keyPrefix: 'nuk_live_abc',
        isActive: true,
        expiresAt: undefined,
        lastUsedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const qb = apiKeyRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([hashedKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      apiKeyRoleRepo.find.mockResolvedValue([]);
      roleRepo.findBy.mockResolvedValue([]);
      apiKeyRepo.save.mockResolvedValue(hashedKey);

      const result = await service.validate(rawKey);

      expect(result.user.id).toBe(1);
      expect(result.apiKey.id).toBe('uuid-1');
      expect(hashedKey.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should throw UnauthorizedException when key not found', async () => {
      const qb = apiKeyRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validate('nuk_live_wrong')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException when key is revoked', async () => {
      const rawKey = 'nuk_live_abc123';
      const hashedKey = {
        id: 'uuid-1',
        userId: 1,
        keyHash: 'hashed',
        isActive: false,
        expiresAt: undefined,
      };

      const qb = apiKeyRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([hashedKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(service.validate(rawKey)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException when key is expired', async () => {
      const rawKey = 'nuk_live_abc123';
      const hashedKey = {
        id: 'uuid-1',
        userId: 1,
        keyHash: 'hashed',
        isActive: true,
        expiresAt: new Date('2020-01-01'),
      };

      const qb = apiKeyRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([hashedKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(service.validate(rawKey)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should resolve roles for a valid key', async () => {
      const rawKey = 'nuk_live_abc123';
      const hashedKey = {
        id: 'uuid-1',
        userId: 1,
        keyHash: 'hashed',
        isActive: true,
        expiresAt: undefined,
      };

      const qb = apiKeyRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([hashedKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      apiKeyRoleRepo.find.mockResolvedValue([{ apiKeyId: 'uuid-1', roleId: 1 }]);
      roleRepo.findBy.mockResolvedValue([
        { id: 1, name: 'admin', permissions: ['admin.access'] },
      ]);
      apiKeyRepo.save.mockResolvedValue(hashedKey);

      const result = await service.validate(rawKey);

      expect(result.user.roles).toBeDefined();
      expect(result.user.permissions).toContain('admin.access');
    });
  });

  describe('assignRole', () => {
    it('should assign a role to an API key', async () => {
      apiKeyRepo.findOneBy.mockResolvedValue({ id: 'uuid-1', userId: 1 });
      roleRepo.findOneBy.mockResolvedValue({ id: 1, name: 'admin' });
      apiKeyRoleRepo.findOneBy.mockResolvedValue(null);
      apiKeyRoleRepo.create.mockImplementation((data: { apiKeyId: string; roleId: number }) => data);
      apiKeyRoleRepo.save.mockResolvedValue({ apiKeyId: 'uuid-1', roleId: 1 });

      const result = await service.assignRole(1, 'uuid-1', 1);

      expect(result.apiKeyId).toBe('uuid-1');
      expect(result.roleId).toBe(1);
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyRepo.findOneBy.mockResolvedValue(null);

      await expect(service.assignRole(1, 'uuid-999', 1)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when role not found', async () => {
      apiKeyRepo.findOneBy.mockResolvedValue({ id: 'uuid-1', userId: 1 });
      roleRepo.findOneBy.mockResolvedValue(null);

      await expect(service.assignRole(1, 'uuid-1', 999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('removeRole', () => {
    it('should remove a role from an API key', async () => {
      apiKeyRepo.findOneBy.mockResolvedValue({ id: 'uuid-1', userId: 1 });
      apiKeyRoleRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.removeRole(1, 'uuid-1', 1);

      expect(result).toBe(true);
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyRepo.findOneBy.mockResolvedValue(null);

      await expect(service.removeRole(1, 'uuid-999', 1)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
