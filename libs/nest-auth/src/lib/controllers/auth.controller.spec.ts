import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../decorators/permissions';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../services/api-key.service';

import { CreateAuthController } from './auth.controller';
import { CreatePermissionsController } from './permissions.controller';
import { CreateRolesController } from './roles.controller';
import { CreateUserRolesController } from './user-roles.controller';
import { CreateApiKeysController } from './api-keys.controller';

const mockOptions = {
  userEntity: class User {
    id = 1;
  },
  identifierField: 'email',
  passkeyField: 'password',
  jwtSecret: 'test-secret',
  disabledRoutes: [] as string[],
  loginDto: class LoginDto {
    email = '';
    password = '';
  },
  registerDto: class RegisterDto {
    email = '';
    password = '';
  },
  permissionRegistry: {
    resources: [
      {
        resource: 'users',
        permissions: ['read', 'manage'],
      },
    ],
  },
};

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  requestOtp: jest.fn(),
  loginWithOtp: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  createRole: jest.fn(),
  getAllRoles: jest.fn(),
  assignPermissionsToRole: jest.fn(),
  removePermissionsFromRole: jest.fn(),
  assignRoleToUser: jest.fn(),
  removeRoleFromUser: jest.fn(),
  getUserRoles: jest.fn(),
};

const mockApiKeyService = {
  create: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
  assignRole: jest.fn(),
  removeRole: jest.fn(),
};

async function createController<T>(
  ControllerClass: new (...args: unknown[]) => T
): Promise<T> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ControllerClass],
    providers: [
      { provide: AuthService, useValue: mockAuthService },
      { provide: AUTH_OPTIONS, useValue: mockOptions },
      { provide: PermissionsGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      { provide: ApiKeyService, useValue: mockApiKeyService },
    ],
  }).compile();

  return module.get(ControllerClass);
}

function PermissionsControllerClass() {
  return CreatePermissionsController(mockOptions) as unknown as new (...args: unknown[]) => unknown;
}
function RolesControllerClass() {
  return CreateRolesController(mockOptions) as unknown as new (...args: unknown[]) => unknown;
}
function UserRolesControllerClass() {
  return CreateUserRolesController(mockOptions) as unknown as new (...args: unknown[]) => unknown;
}
function ApiKeysControllerClass() {
  return CreateApiKeysController(mockOptions) as unknown as new (...args: unknown[]) => unknown;
}

describe('CreateAuthController', () => {
  let controller: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOptions.disabledRoutes = [];
    controller = await createController(CreateAuthController(mockOptions) as unknown as new (...args: unknown[]) => unknown);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register if not disabled', async () => {
      const dto = { email: 'test@test.com' };
      mockAuthService.register.mockResolvedValue({ id: 1, ...dto });
      const result = await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });

    it('should throw ForbiddenException if register is disabled', async () => {
      mockOptions.disabledRoutes = ['register'];
      await expect(controller.register({})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('should call authService.login if not disabled', async () => {
      const credentials = { email: 'test@test.com' };
      mockAuthService.login.mockResolvedValue({ access_token: 'token' });
      const result = await controller.login(credentials);
      expect(mockAuthService.login).toHaveBeenCalledWith(credentials);
      expect(result).toEqual({ access_token: 'token' });
    });

    it('should throw ForbiddenException if login is disabled', async () => {
      mockOptions.disabledRoutes = ['login'];
      await expect(controller.login({})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh with token from body', async () => {
      const body = { refreshToken: 'body-token' };
      mockAuthService.refresh.mockResolvedValue({ access_token: 'new-at' });
      const result = await controller.refresh(body);
      expect(mockAuthService.refresh).toHaveBeenCalledWith('body-token');
      expect(result).toEqual({ access_token: 'new-at' });
    });

    it('should throw ForbiddenException if token is missing', async () => {
      await expect(controller.refresh({ refreshToken: '' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('requestOtp', () => {
    it('should call authService.requestOtp if not disabled', async () => {
      const payload = { email: 'test@test.com' };
      mockAuthService.requestOtp.mockResolvedValue({ success: true });
      const result = await controller.requestOtp(payload);
      expect(mockAuthService.requestOtp).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException if otp/request is disabled', async () => {
      mockOptions.disabledRoutes = ['otp/request'];
      await expect(controller.requestOtp({})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('loginWithOtp', () => {
    it('should call authService.loginWithOtp if not disabled', async () => {
      const payload = { email: 'test@test.com', otpCode: '123456' };
      mockAuthService.loginWithOtp.mockResolvedValue({ access_token: 'token' });
      const result = await controller.loginWithOtp(payload);
      expect(mockAuthService.loginWithOtp).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ access_token: 'token' });
    });

    it('should throw ForbiddenException if otp/login is disabled', async () => {
      mockOptions.disabledRoutes = ['otp/login'];
      await expect(controller.loginWithOtp({})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('me', () => {
    it('should return the current user', async () => {
      const user = { id: 1, email: 'test@test.com' };
      const result = await controller.me(user);
      expect(result).toEqual(user);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user id', async () => {
      const user = { id: 1 };
      mockAuthService.logout.mockResolvedValue(true);
      const result = await controller.logout(user);
      expect(mockAuthService.logout).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });
});

describe('CreatePermissionsController', () => {
  let controller: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await createController(PermissionsControllerClass());
  });

  describe('getMyPermissions', () => {
    it('should return resolved direct and role permissions for the current user', () => {
      const user = {
        id: 1,
        permissions: ['posts.read'],
        roles: [{ permissions: ['posts.create'] }],
      };

      const result = controller.getMyPermissions(user);
      expect(result).toEqual(['posts.read', 'posts.create']);
    });
  });

  describe('getRegisteredPermissions', () => {
    it('should return configured registry and flattened permissions', () => {
      const result = controller.getRegisteredPermissions();
      expect(result).toEqual({
        resources: [
          {
            resource: 'users',
            permissions: ['users.read', 'users.manage'],
          },
        ],
        permissions: ['admin.access', 'users.manage', 'users.read'],
      });
    });
  });
});

describe('CreateRolesController', () => {
  let controller: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await createController(RolesControllerClass());
  });

  describe('createRole', () => {
    it('should call authService.createRole', async () => {
      const dto = { name: 'admin' };
      mockAuthService.createRole.mockResolvedValue({ id: 1, name: 'admin' });
      const result = await controller.createRole(dto);
      expect(mockAuthService.createRole).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, name: 'admin' });
    });
  });

  describe('getAllRoles', () => {
    it('should call authService.getAllRoles', async () => {
      mockAuthService.getAllRoles.mockResolvedValue([]);
      const result = await controller.getAllRoles();
      expect(mockAuthService.getAllRoles).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('assignPermissionsToRole', () => {
    it('should call authService.assignPermissionsToRole', async () => {
      mockAuthService.assignPermissionsToRole.mockResolvedValue({ id: 1 });
      const result = await controller.assignPermissionsToRole(1, { permissions: ['users.read'] });
      expect(mockAuthService.assignPermissionsToRole).toHaveBeenCalledWith(1, ['users.read']);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('removePermissionsFromRole', () => {
    it('should call authService.removePermissionsFromRole', async () => {
      mockAuthService.removePermissionsFromRole.mockResolvedValue({ id: 1 });
      const result = await controller.removePermissionsFromRole(1, { permissions: ['users.read'] });
      expect(mockAuthService.removePermissionsFromRole).toHaveBeenCalledWith(1, ['users.read']);
      expect(result).toEqual({ id: 1 });
    });
  });
});

describe('CreateUserRolesController', () => {
  let controller: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await createController(UserRolesControllerClass());
  });

  describe('assignRoleToUser', () => {
    it('should call authService.assignRoleToUser', async () => {
      mockAuthService.assignRoleToUser.mockResolvedValue({ success: true });
      const result = await controller.assignRoleToUser(1, 2);
      expect(mockAuthService.assignRoleToUser).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('removeRoleFromUser', () => {
    it('should call authService.removeRoleFromUser', async () => {
      mockAuthService.removeRoleFromUser.mockResolvedValue({ success: true });
      const result = await controller.removeRoleFromUser(1, 2);
      expect(mockAuthService.removeRoleFromUser).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getUserRoles', () => {
    it('should call authService.getUserRoles', async () => {
      mockAuthService.getUserRoles.mockResolvedValue([]);
      const result = await controller.getUserRoles(1);
      expect(mockAuthService.getUserRoles).toHaveBeenCalledWith(1);
      expect(result).toEqual([]);
    });
  });
});

describe('CreateApiKeysController', () => {
  let controller: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await createController(ApiKeysControllerClass());
  });

  describe('createApiKey', () => {
    it('should call apiKeyService.create', async () => {
      mockApiKeyService.create.mockResolvedValue({ key: 'sk-xxx' });
      const result = await controller.createApiKey({ id: 1 }, { name: 'test' });
      expect(mockApiKeyService.create).toHaveBeenCalledWith(1, { name: 'test' });
      expect(result).toEqual({ key: 'sk-xxx' });
    });
  });

  describe('listApiKeys', () => {
    it('should call apiKeyService.list', async () => {
      mockApiKeyService.list.mockResolvedValue([]);
      const result = await controller.listApiKeys({ id: 1 });
      expect(mockApiKeyService.list).toHaveBeenCalledWith(1);
      expect(result).toEqual([]);
    });
  });

  describe('revokeApiKey', () => {
    it('should call apiKeyService.revoke', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockApiKeyService.revoke.mockResolvedValue({ revoked: true });
      const result = await controller.revokeApiKey({ id: 1 }, uuid);
      expect(mockApiKeyService.revoke).toHaveBeenCalledWith(1, uuid);
      expect(result).toEqual({ revoked: true });
    });
  });

  describe('assignRoleToApiKey', () => {
    it('should call apiKeyService.assignRole', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockApiKeyService.assignRole.mockResolvedValue({ success: true });
      const result = await controller.assignRoleToApiKey({ id: 1 }, uuid, 2);
      expect(mockApiKeyService.assignRole).toHaveBeenCalledWith(1, uuid, 2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('removeRoleFromApiKey', () => {
    it('should call apiKeyService.removeRole', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockApiKeyService.removeRole.mockResolvedValue({ success: true });
      const result = await controller.removeRoleFromApiKey({ id: 1 }, uuid, 2);
      expect(mockApiKeyService.removeRole).toHaveBeenCalledWith(1, uuid, 2);
      expect(result).toEqual({ success: true });
    });
  });
});

describe('admin route permissions', () => {
  it('should require admin.access on admin auth routes', () => {
    const methodMap: [unknown, string[]][] = [
      [CreateAuthController(mockOptions), []],
      [CreatePermissionsController(mockOptions), ['getRegisteredPermissions']],
      [CreateRolesController(mockOptions), ['createRole', 'getAllRoles', 'assignPermissionsToRole', 'removePermissionsFromRole']],
      [CreateUserRolesController(mockOptions), ['assignRoleToUser', 'removeRoleFromUser', 'getUserRoles']],
      [CreateApiKeysController(mockOptions), ['createApiKey', 'listApiKeys', 'revokeApiKey', 'assignRoleToApiKey', 'removeRoleFromApiKey']],
    ] as const;

    for (const [ControllerClass, methodNames] of methodMap) {
      const controller = new (ControllerClass as new (...args: unknown[]) => unknown)(
        mockAuthService,
        mockOptions,
        mockApiKeyService
      );

      for (const methodName of methodNames) {
        const handler = (controller as any)[methodName];
        expect(handler).toBeDefined();

        const requiredPermissions = Reflect.getMetadata(
          PERMISSIONS_KEY,
          handler
        ) as string[];

        expect(requiredPermissions).toEqual(['admin.access']);
      }
    }
  });
});
