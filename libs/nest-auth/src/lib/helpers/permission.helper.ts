import { AuthUser } from '../interfaces/user.interface';
import { AuthRbacOptions } from '../interfaces/rbac-options.interface';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const toObjectArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null
  );
};

export const resolvePermissions = (
  user: AuthUser,
  rbacOptions?: AuthRbacOptions
): string[] => {
  const directPermissionsKey = rbacOptions?.directPermissionsKey ?? 'permissions';
  const rolesKey = rbacOptions?.rolesKey ?? 'roles';
  const rolePermissionsKey = rbacOptions?.rolePermissionsKey ?? 'permissions';
  const nestedRoleKey = rbacOptions?.nestedRoleKey ?? 'role';

  const permissions = new Set<string>();

  toStringArray(user[directPermissionsKey]).forEach((permission) =>
    permissions.add(permission)
  );

  toObjectArray(user[rolesKey]).forEach((roleLike) => {
    toStringArray(roleLike[rolePermissionsKey]).forEach((permission) =>
      permissions.add(permission)
    );

    const nestedRole = roleLike[nestedRoleKey];
    if (typeof nestedRole === 'object' && nestedRole !== null) {
      toStringArray((nestedRole as Record<string, unknown>)[rolePermissionsKey]).forEach(
        (permission) => permissions.add(permission)
      );
    }
  });

  return [...permissions];
};
