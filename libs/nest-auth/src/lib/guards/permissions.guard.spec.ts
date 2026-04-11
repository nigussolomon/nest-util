import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import {
  ALLOWED_ROLES_KEY,
  ALLOW_ANY_PERMISSION_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../constants';
import { IS_PUBLIC_KEY } from '../decorators/public';
import type { AuthModuleOptions } from '../interfaces/auth-options';

type ContextInput = {
  handler: object;
  classRef: object;
  user?: Record<string, unknown>;
};

const createContext = ({ handler, classRef, user }: ContextInput) =>
  ({
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as ExecutionContext;

describe('PermissionsGuard', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('allows public routes', async () => {
    class TestClass {}
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);

    const guard = new PermissionsGuard(reflector, {} as AuthModuleOptions);

    await expect(
      guard.canActivate(
        createContext({
          handler,
          classRef: TestClass,
        })
      )
    ).resolves.toBe(true);
  });

  it('denies protected route without metadata when denyByDefault is enabled', async () => {
    class TestClass {}
    const handler = () => undefined;
    const guard = new PermissionsGuard(reflector, {
      rbac: { enabled: true, denyByDefault: true },
    } as AuthModuleOptions);

    await expect(
      guard.canActivate(
        createContext({
          handler,
          classRef: TestClass,
          user: { id: 1, roles: ['viewer'] },
        })
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows route with required permissions resolved from role map', async () => {
    class TestClass {}
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['posts:read'], handler);
    const guard = new PermissionsGuard(reflector, {
      rbac: {
        enabled: true,
        rolesField: 'roles',
        rolePermissions: {
          viewer: ['posts:read'],
        },
      },
    } as unknown as AuthModuleOptions);

    await expect(
      guard.canActivate(
        createContext({
          handler,
          classRef: TestClass,
          user: { id: 1, roles: ['viewer'] },
        })
      )
    ).resolves.toBe(true);
  });

  it('allows role shortcuts with ALLOWED_ROLES metadata', async () => {
    class TestClass {}
    const handler = () => undefined;
    Reflect.defineMetadata(ALLOWED_ROLES_KEY, ['admin'], handler);
    const guard = new PermissionsGuard(reflector, {
      rbac: {
        enabled: true,
        rolesField: 'roles',
      },
    } as AuthModuleOptions);

    await expect(
      guard.canActivate(
        createContext({
          handler,
          classRef: TestClass,
          user: { id: 1, roles: ['admin'] },
        })
      )
    ).resolves.toBe(true);
  });

  it('throws forbidden for missing required permission', async () => {
    class TestClass {}
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['users:write'], handler);
    const guard = new PermissionsGuard(reflector, {
      rbac: {
        enabled: true,
        rolesField: 'roles',
        rolePermissions: {
          viewer: ['users:read'],
        },
      },
    } as unknown as AuthModuleOptions);

    await expect(
      guard.canActivate(
        createContext({
          handler,
          classRef: TestClass,
          user: { id: 1, roles: ['viewer'] },
        })
      )
    ).rejects.toThrow('Missing required permissions: users:write');
  });

  it('allows route with AllowAnyPermission metadata', async () => {
    class TestClass {}
    const handler = () => undefined;
    Reflect.defineMetadata(ALLOW_ANY_PERMISSION_KEY, true, handler);
    const guard = new PermissionsGuard(reflector, {
      rbac: {
        enabled: true,
        denyByDefault: true,
      },
    } as AuthModuleOptions);

    await expect(
      guard.canActivate(
        createContext({
          handler,
          classRef: TestClass,
          user: { id: 1, roles: ['viewer'] },
        })
      )
    ).resolves.toBe(true);
  });
});
