export interface UserManagementOptions {
  /**
   * Whether the user management controller is enabled.
   * @default true (when the options block is provided)
   */
  enabled?: boolean;

  /**
   * Permission string guarding every user management route.
   * @default 'admin.access'
   */
  permission?: string;

  /**
   * Field on the user entity that holds the active/inactive flag.
   * @default 'isActive'
   */
  activeField?: string;

  /**
   * Whitelist of user columns returned in list/get responses. When omitted,
   * all columns except sensitive ones (password, tokens, codes) are returned.
   */
  listFields?: string[];

  /**
   * Whitelist of keys accepted when creating a user via POST. When omitted,
   * any key except sensitive ones is accepted.
   */
  createFields?: string[];

  /**
   * Whitelist of keys accepted when updating a user via PATCH. When omitted,
   * any key except sensitive ones is accepted.
   */
  updateFields?: string[];

  /**
   * Permission string guarding the self-service PATCH /auth/me route. Assign
   * this permission to a role so regular users can edit their own profile.
   * @default 'profile.edit'
   */
  profilePermission?: string;

  /**
   * Whitelist of keys a user may edit on their own profile via PATCH /auth/me.
   * When omitted, falls back to `updateFields`, then to any key except
   * sensitive ones and the active flag.
   */
  profileFields?: string[];

  /**
   * Relations to eager-load in list/get responses.
   * @default AuthModuleOptions.relations
   */
  relations?: string[];

  /**
   * Whether the POST /auth/users route accepts a password (hashed with bcrypt).
   * @default true
   */
  allowPassword?: boolean;

  /**
   * Maximum page size for the list route.
   * @default 100
   */
  maxLimit?: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  q?: string;
  active?: boolean;
}

export interface UserListResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}
