import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import { ApiKeyService } from '../services/api-key.service';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CreateUserManagementController } from './user-management.controller';

const mockOptions: Record<string, unknown> = {
  userEntity: class User {
    id = 1;
  },
  identifierField: 'email',
  passkeyField: 'password',
  jwtSecret: 'test-secret',
  userManagement: {
    enabled: true,
  },
};

const mockAuthService = {
  listUsers: jest.fn(),
  getUserById: jest.fn(),
  createUserByAdmin: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
  deleteUser: jest.fn(),
};

const mockApiKeyService = {
  create: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
  assignRole: jest.fn(),
  removeRole: jest.fn(),
};

const mockDataSource = {
  getRepository: jest.fn().mockReturnValue({
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('CreateUserManagementController', () => {
  let controller: any;
  const ControllerClass = CreateUserManagementController(
    mockOptions as never
  ) as unknown as new (...args: unknown[]) => unknown;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ControllerClass],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AUTH_OPTIONS, useValue: mockOptions },
        {
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: ApiKeyService, useValue: mockApiKeyService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get(ControllerClass);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listUsers', () => {
    it('calls authService.listUsers with parsed pagination and active filter', async () => {
      mockAuthService.listUsers.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      const query = { page: '2', limit: '10', active: 'true', q: 'ali' };
      const result = await controller.listUsers(query);
      expect(mockAuthService.listUsers).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        q: 'ali',
        active: true,
      });
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    });

    it('omits invalid page/limit and non-boolean active', async () => {
      await controller.listUsers({ page: 'abc', limit: '', active: 'yes' });
      expect(mockAuthService.listUsers).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        q: undefined,
        active: undefined,
      });
    });
  });

  describe('getUserById', () => {
    it('calls authService.getUserById with the id', async () => {
      mockAuthService.getUserById.mockResolvedValue({ id: 5 });
      const result = await controller.getUserById(5);
      expect(mockAuthService.getUserById).toHaveBeenCalledWith(5);
      expect(result).toEqual({ id: 5 });
    });
  });

  describe('createUser', () => {
    it('calls authService.createUserByAdmin with the body', async () => {
      mockAuthService.createUserByAdmin.mockResolvedValue({ id: 1 });
      const body = { email: 'a@b.com', name: 'Alice' };
      const result = await controller.createUser(body);
      expect(mockAuthService.createUserByAdmin).toHaveBeenCalledWith(body);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('updateUser', () => {
    it('calls authService.updateUser with id and body', async () => {
      mockAuthService.updateUser.mockResolvedValue({ id: 1 });
      const result = await controller.updateUser(1, { name: 'Bob' });
      expect(mockAuthService.updateUser).toHaveBeenCalledWith(1, { name: 'Bob' });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('activateUser / deactivateUser', () => {
    it('calls setUserActive(true)', async () => {
      await controller.activateUser(3);
      expect(mockAuthService.setUserActive).toHaveBeenCalledWith(3, true);
    });

    it('calls setUserActive(false)', async () => {
      await controller.deactivateUser(3);
      expect(mockAuthService.setUserActive).toHaveBeenCalledWith(3, false);
    });
  });

  describe('deleteUser', () => {
    it('calls authService.deleteUser with the id', async () => {
      mockAuthService.deleteUser.mockResolvedValue(true);
      const result = await controller.deleteUser(4);
      expect(mockAuthService.deleteUser).toHaveBeenCalledWith(4);
      expect(result).toBe(true);
    });
  });
});

describe('user management route permissions', () => {
  it('guards every route with admin.access by default', () => {
    const controller = new (CreateUserManagementController(
      mockOptions as never
    ) as unknown as new (...args: unknown[]) => unknown)(
      mockAuthService,
      mockOptions
    );

    const methods = [
      'listUsers',
      'getUserById',
      'createUser',
      'updateUser',
      'activateUser',
      'deactivateUser',
      'deleteUser',
    ];

    for (const methodName of methods) {
      const handler = (controller as any)[methodName];
      expect(handler).toBeDefined();
      const requiredPermissions = Reflect.getMetadata(
        PERMISSIONS_KEY,
        handler
      ) as string[];
      expect(requiredPermissions).toEqual(['admin.access']);
    }
  });

  it('uses the configured permission when provided', () => {
    const customOptions = {
      ...mockOptions,
      userManagement: { permission: 'users.manage' },
    };

    const controller = new (CreateUserManagementController(
      customOptions as never
    ) as unknown as new (...args: unknown[]) => unknown)(
      mockAuthService,
      customOptions
    );

    const requiredPermissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      (controller as any).listUsers
    ) as string[];
    expect(requiredPermissions).toEqual(['users.manage']);
  });
});
