export interface PermissionRegistryResource {
  resource: string;
  permissions: readonly string[];
}

export interface PermissionRegistryConfig {
  resources: readonly PermissionRegistryResource[];
}

export interface ResolvedPermissionRegistry {
  resources: PermissionRegistryResource[];
  permissions: string[];
}

export type CrudRegistryEndpoint =
  | 'findAll'
  | 'findOne'
  | 'create'
  | 'update'
  | 'remove'
  | 'findAuditLogs'
  | 'findMine'
  | 'changeStatus'
  | 'getApproval'
  | 'approveApproval'
  | 'rejectApproval'
  | 'requestModification'
  | 'resubmitApproval';

export type CrudEndpointActions = Partial<Record<CrudRegistryEndpoint, string>>;

export interface BuildCrudPermissionsOptions {
  resource: string;
  endpointActions?: CrudEndpointActions;
  strict?: boolean;
}
