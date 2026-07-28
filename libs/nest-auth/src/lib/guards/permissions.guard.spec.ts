import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  const createContext = (user?: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    guard = new PermissionsGuard(reflector, {
      userEntity: class User {},
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'secret',
    });
  });

  it('allows access when no permissions are required', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([]);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('allows access when all required permissions are present', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['posts.read', 'posts.write']);

    await expect(
      guard.canActivate(
        createContext({
          id: 1,
          permissions: ['posts.read'],
          roles: [{ permissions: ['posts.write'] }],
        })
      )
    ).resolves.toBe(true);
  });

  it('supports user-role records via nested role resolution', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['users.invite']);

    guard = new PermissionsGuard(reflector, {
      userEntity: class User {},
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'secret',
      rbac: {
        rolesKey: 'userRoles',
        nestedRoleKey: 'role',
      },
    });

    await expect(
      guard.canActivate(
        createContext({
          id: 1,
          userRoles: [{ role: { permissions: ['users.invite'] } }],
        })
      )
    ).resolves.toBe(true);
  });

  it('throws when a required permission is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin.access']);

    await expect(
      guard.canActivate(createContext({ id: 1, permissions: ['posts.read'] }))
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows access when user has superAdminPermission even without required permissions', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin.access']);

    guard = new PermissionsGuard(reflector, {
      userEntity: class User {},
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'secret',
      rbac: {
        superAdminPermission: 'admin.access',
      },
    });

    await expect(
      guard.canActivate(
        createContext({
          id: 1,
          permissions: ['admin.access'],
        })
      )
    ).resolves.toBe(true);
  });

  it('does not bypass when superAdminPermission is set but user lacks it', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin.access']);

    guard = new PermissionsGuard(reflector, {
      userEntity: class User {},
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'secret',
      rbac: {
        superAdminPermission: 'admin.access',
      },
    });

    await expect(
      guard.canActivate(
        createContext({
          id: 1,
          permissions: ['posts.read'],
        })
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('bypasses custom evaluator when user has superAdminPermission', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['some.deep.permission']);

    const permissionEvaluator = jest.fn();

    guard = new PermissionsGuard(reflector, {
      userEntity: class User {},
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'secret',
      rbac: {
        superAdminPermission: 'root',
        permissionEvaluator,
      },
    });

    await expect(
      guard.canActivate(
        createContext({
          id: 1,
          permissions: ['root'],
        })
      )
    ).resolves.toBe(true);

    expect(permissionEvaluator).not.toHaveBeenCalled();
  });

  it('delegates to a custom evaluator when configured', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['reports.export']);

    const permissionEvaluator = jest.fn().mockResolvedValue(true);

    guard = new PermissionsGuard(reflector, {
      userEntity: class User {},
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'secret',
      rbac: {
        permissionEvaluator,
      },
    });

    await expect(
      guard.canActivate(createContext({ id: 1, permissions: [] }))
    ).resolves.toBe(true);
    expect(permissionEvaluator).toHaveBeenCalled();
  });
});
