import {
  BuildCrudPermissionsOptions,
  CrudEndpointActions,
  CrudRegistryEndpoint,
  PermissionRegistryConfig,
  PermissionRegistryResource,
  ResolvedPermissionRegistry,
} from '../interfaces/permission-registry.interface';

const DEFAULT_CRUD_ENDPOINT_ACTIONS: Record<CrudRegistryEndpoint, string> = {
  findAll: 'read',
  findOne: 'read',
  create: 'create',
  update: 'update',
  remove: 'delete',
  findAuditLogs: 'audit',
};

const toCleanString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const toPermissionKey = (resource: string, action: string): string => {
  const cleanResource = toCleanString(resource);
  const cleanAction = toCleanString(action);

  if (!cleanAction) {
    return '';
  }

  if (
    cleanAction.includes('.') &&
    cleanAction.startsWith(`${cleanResource}.`)
  ) {
    return cleanAction;
  }

  if (!cleanResource) {
    return '';
  }

  return `${cleanResource}.${cleanAction}`;
};

const normalizeResources = (
  resources: readonly PermissionRegistryResource[] = []
): PermissionRegistryResource[] => {
  const normalized: PermissionRegistryResource[] = [];

  for (const resourceConfig of resources) {
    const resource = toCleanString(resourceConfig.resource);
    if (!resource) {
      continue;
    }

    const permissions = [
      ...new Set(
        (resourceConfig.permissions ?? [])
          .map((permission) => toPermissionKey(resource, permission))
          .filter((permission) => Boolean(permission))
      ),
    ];

    normalized.push({ resource, permissions });
  }

  return normalized;
};

export const resolvePermissionRegistry = (
  registry?: PermissionRegistryConfig
): ResolvedPermissionRegistry => {
  const normalizedResources = normalizeResources(registry?.resources ?? []);
  const permissionSet = new Set<string>(['admin.access']);

  for (const resourceConfig of normalizedResources) {
    for (const permission of resourceConfig.permissions) {
      permissionSet.add(permission);
    }
  }

  return {
    resources: normalizedResources,
    permissions: [...permissionSet].sort((a, b) => a.localeCompare(b)),
  };
};

export const buildCrudPermissionsFromRegistry = (
  registry: PermissionRegistryConfig | undefined,
  options: BuildCrudPermissionsOptions
): Partial<Record<CrudRegistryEndpoint, string>> => {
  const resolvedRegistry = resolvePermissionRegistry(registry);
  const availablePermissions = new Set(resolvedRegistry.permissions);
  const endpointActions: CrudEndpointActions = {
    ...DEFAULT_CRUD_ENDPOINT_ACTIONS,
    ...options.endpointActions,
  };

  const permissionsMap: Partial<Record<CrudRegistryEndpoint, string>> = {};

  for (const endpoint of Object.keys(
    endpointActions
  ) as CrudRegistryEndpoint[]) {
    const action = endpointActions[endpoint];
    if (!action) {
      continue;
    }

    const permissionKey = toPermissionKey(options.resource, action);
    if (!permissionKey) {
      continue;
    }

    if (!availablePermissions.has(permissionKey)) {
      if (options.strict !== false) {
        throw new Error(
          `Missing permission \"${permissionKey}\" in auth permission registry`
        );
      }

      continue;
    }

    permissionsMap[endpoint] = permissionKey;
  }

  return permissionsMap;
};
