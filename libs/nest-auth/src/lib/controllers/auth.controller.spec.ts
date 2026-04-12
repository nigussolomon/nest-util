import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../decorators/permissions';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Reflector } from '@nestjs/core';

import { CreateAuthController } from './auth.controller';

describe('AuthController', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let controller: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;

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

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const ControllerClass = CreateAuthController(mockOptions);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ControllerClass],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: AUTH_OPTIONS,
          useValue: mockOptions,
        },
        {
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(ControllerClass);
    mockOptions.disabledRoutes = []; // reset
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register if not disabled', async () => {
      const dto = { email: 'test@test.com' };
      authService.register.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
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
      authService.login.mockResolvedValue({ access_token: 'token' });

      const result = await controller.login(credentials);

      expect(authService.login).toHaveBeenCalledWith(credentials);
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
      authService.refresh.mockResolvedValue({ access_token: 'new-at' });

      const result = await controller.refresh(body);

      expect(authService.refresh).toHaveBeenCalledWith('body-token');
      expect(result).toEqual({ access_token: 'new-at' });
    });

    it('should throw ForbiddenException if token is missing', async () => {
      await expect(controller.refresh({ refreshToken: '' })).rejects.toThrow(
        ForbiddenException
      );
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
      authService.logout.mockResolvedValue(true);

      const result = await controller.logout(user);

      expect(authService.logout).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
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

  describe('admin route permissions', () => {
    it('should require admin.access on admin auth routes', () => {
      const methodNames = [
        'createRole',
        'getRegisteredPermissions',
        'getAllRoles',
        'assignRoleToUser',
        'assignPermissionsToRole',
        'removePermissionsFromRole',
        'removeRoleFromUser',
        'getUserRoles',
      ] as const;

      for (const methodName of methodNames) {
        const handler = controller[methodName];
        expect(handler).toBeDefined();

        const requiredPermissions = Reflect.getMetadata(
          PERMISSIONS_KEY,
          handler
        ) as string[];

        expect(requiredPermissions).toEqual(['admin.access']);
      }
    });
  });
});
