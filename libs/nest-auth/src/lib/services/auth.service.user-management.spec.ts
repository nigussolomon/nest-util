import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RoleEntity } from '../entities/role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';

jest.mock('bcrypt');

describe('AuthService - user management', () => {
  let service: AuthService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manager: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userRoleRepository: any;

  const mockUserEntity = class User {
    id: number | string = 1;
    email = 'test@example.com';
    password = 'hashed-password';
    refreshToken = 'hashed-rt';
    accessToken = 'hashed-at';
    isActive = true;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockOptions: any = {
    userEntity: mockUserEntity,
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
  };

  const jwtService = { sign: jest.fn(), verify: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    mockOptions.identifierFields = undefined;
    mockOptions.otp = undefined;
    mockOptions.verification = undefined;
    mockOptions.passwordReset = undefined;
    mockOptions.refreshTokenField = 'refreshToken';
    mockOptions.accessTokenField = 'accessToken';
    mockOptions.userManagement = undefined;
    mockOptions.relations = undefined;
    mockOptions.registerHooks = undefined;

    repository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((entity: unknown) => entity),
      save: jest.fn(async (entity: unknown) => entity),
    };

    roleRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    userRoleRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === RoleEntity) return roleRepository;
        if (entity === UserRoleEntity) return userRoleRepository;
        return repository;
      }),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
      transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(manager)),
    };

    service = new AuthService(
      mockOptions,
      jwtService as never,
      mockDataSource as never,
      undefined
    );
  });

  const userRow = {
    id: 1,
    email: 'a@b.com',
    name: 'Alice',
    isActive: true,
    password: 'hashed-password',
    refreshToken: 'hashed-rt',
    accessToken: 'hashed-at',
  };

  describe('listUsers', () => {
    it('returns paginated users with sensitive fields stripped', async () => {
      repository.findAndCount.mockResolvedValue([[userRow], 1]);

      const result = await service.listUsers();

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.items[0]).not.toHaveProperty('password');
      expect(result.items[0]).not.toHaveProperty('refreshToken');
      expect(result.items[0]).not.toHaveProperty('accessToken');
      expect(result.items[0]).toMatchObject({
        id: 1,
        email: 'a@b.com',
        name: 'Alice',
        isActive: true,
      });
    });

    it('respects the listFields whitelist', async () => {
      mockOptions.userManagement = { listFields: ['email', 'name'] };
      repository.findAndCount.mockResolvedValue([[userRow], 1]);

      const result = await service.listUsers();

      expect(result.items[0]).toEqual({ id: 1, email: 'a@b.com', name: 'Alice' });
    });

    it('applies the active filter', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.listUsers({ active: false });

      const [query] = repository.findAndCount.mock.calls[0];
      expect(query.where).toEqual([{ isActive: false }]);
    });

    it('searches across identifier fields when q is provided', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.listUsers({ q: 'ali' });

      const [query] = repository.findAndCount.mock.calls[0];
      expect(query.where).toHaveLength(1);
      expect(query.where[0].email).toEqual(expect.anything());
    });

    it('caps limit at maxLimit', async () => {
      mockOptions.userManagement = { maxLimit: 50 };
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.listUsers({ limit: 1000 });

      const [query] = repository.findAndCount.mock.calls[0];
      expect(query.take).toBe(50);
    });
  });

  describe('getUserById', () => {
    it('returns the user with sensitive fields stripped', async () => {
      repository.findOne.mockResolvedValue(userRow);

      const result = await service.getUserById(1);

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('a@b.com');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(service.getUserById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUserByAdmin', () => {
    it('throws BadRequestException when no identifier is provided', async () => {
      await expect(service.createUserByAdmin({ name: 'No Email' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws ConflictException when the identifier already exists', async () => {
      repository.findOne.mockResolvedValue({ id: 2 });

      await expect(
        service.createUserByAdmin({ email: 'a@b.com' })
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and defaults isActive to true', async () => {
      repository.findOne.mockResolvedValue(undefined);

      const result = await service.createUserByAdmin({
        email: 'new@b.com',
        name: 'New',
        password: 'secret',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@b.com',
          name: 'New',
          isActive: true,
        })
      );
      expect(result).not.toHaveProperty('password');
      expect(result.isActive).toBe(true);
    });

    it('rejects keys outside createFields when a whitelist is configured', async () => {
      mockOptions.userManagement = { createFields: ['name'] };
      repository.findOne.mockResolvedValue(undefined);

      await expect(
        service.createUserByAdmin({
          email: 'new@b.com',
          name: 'New',
          isActive: false,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects sensitive fields when no whitelist is configured', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(
        service.createUserByAdmin({
          email: 'new@b.com',
          refreshToken: 'attacker-controlled',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUser', () => {
    it('updates whitelisted fields and returns the fresh user', async () => {
      mockOptions.userManagement = { updateFields: ['name'] };
      repository.findOne.mockResolvedValue({ ...userRow });
      repository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateUser(1, { name: 'Bob' });

      expect(repository.update).toHaveBeenCalledWith(1, { name: 'Bob' });
      expect(result.name).toBe('Alice');
    });

    it('rejects updating the password field', async () => {
      repository.findOne.mockResolvedValue(userRow);

      await expect(
        service.updateUser(1, { password: 'new-password' })
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects keys outside updateFields when a whitelist is configured', async () => {
      mockOptions.userManagement = { updateFields: ['name'] };
      repository.findOne.mockResolvedValue(userRow);

      await expect(
        service.updateUser(1, { isActive: false })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no updatable fields remain', async () => {
      mockOptions.userManagement = { updateFields: ['name'] };
      repository.findOne.mockResolvedValue(userRow);

      await expect(service.updateUser(1, { isActive: false })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(service.updateUser(99, { name: 'Bob' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('setUserActive', () => {
    it('sets the active field to the given value', async () => {
      repository.findOne.mockResolvedValue(userRow);
      repository.update.mockResolvedValue({ affected: 1 });

      await service.setUserActive(1, false);

      expect(repository.update).toHaveBeenCalledWith(1, { isActive: false });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(service.setUserActive(99, true)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('deleteUser', () => {
    it('deletes the user and returns true', async () => {
      repository.findOne.mockResolvedValue(userRow);
      repository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteUser(1);

      expect(repository.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(service.deleteUser(99)).rejects.toThrow(NotFoundException);
    });
  });
});
