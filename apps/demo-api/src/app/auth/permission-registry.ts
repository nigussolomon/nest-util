import { PermissionRegistryConfig } from '@nest-util/nest-auth';

export const permissionRegistry: PermissionRegistryConfig = {
  resources: [
    {
      resource: 'admin',
      permissions: ['access'],
    },
    {
      resource: 'users',
      permissions: ['read', 'manage'],
    },
    {
      resource: 'posts',
      permissions: ['read', 'create', 'update', 'delete', 'audit'],
    },
  ],
};
