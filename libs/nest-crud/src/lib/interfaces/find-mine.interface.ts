import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Minimal structural view of the authenticated user passed to ownership
 * enforcement. Compatible with `AuthUser` from `@nest-util/nest-auth`.
 */
export interface OwnershipUser {
  id?: string | number;
  permissions?: readonly string[];
  [key: string]: unknown;
}

export interface FindMineConfig<TEntity extends ObjectLiteral> {
  userOwnershipField?: keyof TEntity;
  findMineQuery?: (qb: SelectQueryBuilder<TEntity>, userId: string | number) => void;

  /**
   * When true (and an ownership field/query is configured), the generic
   * `findOne`, `update`, and `remove` operations are scoped to records owned
   * by the passed-in user. Non-owned records resolve to 404; missing user
   * resolves to 403. Defaults to false - existing behavior is preserved.
   */
  enforceOwnership?: boolean;

  /**
   * Permission strings that grant full access and bypass ownership checks.
   * Example: ['admin.access'].
   */
  ownershipBypassPermissions?: readonly string[];

  /**
   * Custom predicate that grants full access and bypasses ownership checks.
   * Takes precedence alongside ownershipBypassPermissions.
   */
  ownershipBypass?: (user: OwnershipUser) => boolean;
}
