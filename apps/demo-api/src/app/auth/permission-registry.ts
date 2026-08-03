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
      resource: 'onboarding',
      permissions: ['start', 'complete'],
    },
    {
      resource: 'posts',
      permissions: ['read', 'create', 'update', 'delete', 'audit'],
    },
    {
      resource: 'payments',
      permissions: ['create', 'read', 'refund', 'subscribe', 'reconcile'],
    },
    {
      resource: 'files',
      permissions: ['create', 'read', 'delete'],
    },
    {
      resource: 'notify',
      permissions: ['push', 'email', 'devices', 'history'],
    },
  ],
};
