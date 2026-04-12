import {
  buildCrudPermissionsFromRegistry,
  resolvePermissionRegistry,
} from './permission-registry.helper';

describe('permission registry helper', () => {
  it('resolves resources and always includes admin.access', () => {
    const result = resolvePermissionRegistry({
      resources: [
        {
          resource: 'users',
          permissions: ['read', 'manage'],
        },
      ],
    });

    expect(result.resources).toEqual([
      {
        resource: 'users',
        permissions: ['users.read', 'users.manage'],
      },
    ]);
    expect(result.permissions).toEqual([
      'admin.access',
      'users.manage',
      'users.read',
    ]);
  });

  it('builds CRUD permissions from registry with endpoint overrides', () => {
    const permissions = buildCrudPermissionsFromRegistry(
      {
        resources: [
          {
            resource: 'posts',
            permissions: ['read', 'create', 'update', 'delete', 'audit'],
          },
        ],
      },
      {
        resource: 'posts',
      }
    );

    expect(permissions).toEqual({
      findAll: 'posts.read',
      findOne: 'posts.read',
      create: 'posts.create',
      update: 'posts.update',
      remove: 'posts.delete',
      findAuditLogs: 'posts.audit',
    });
  });

  it('throws in strict mode when an endpoint permission is missing', () => {
    expect(() =>
      buildCrudPermissionsFromRegistry(
        {
          resources: [
            {
              resource: 'posts',
              permissions: ['read'],
            },
          ],
        },
        {
          resource: 'posts',
        }
      )
    ).toThrow('Missing permission "posts.create" in auth permission registry');
  });

  it('skips missing endpoint permissions when strict is false', () => {
    const permissions = buildCrudPermissionsFromRegistry(
      {
        resources: [
          {
            resource: 'posts',
            permissions: ['read'],
          },
        ],
      },
      {
        resource: 'posts',
        strict: false,
      }
    );

    expect(permissions).toEqual({
      findAll: 'posts.read',
      findOne: 'posts.read',
    });
  });
});
