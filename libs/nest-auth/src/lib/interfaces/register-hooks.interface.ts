import { EntityManager } from 'typeorm';

export type RegisterHook = (
  context: RegisterHookContext
) => Promise<void> | void;

export interface RegisterHookContext {
  /**
   * Mutable registration DTO. Mutations in beforeRegister flow into the saved user.
   */
  payload: Record<string, unknown>;

  /**
   * The saved user entity. Only available in afterRegister.
   */
  entity?: Record<string, unknown>;

  /**
   * The saved user id. Only available in afterRegister.
   */
  userId?: string | number;

  /**
   * Transaction-scoped EntityManager. All writes performed through it are
   * atomic with the user creation — if any hook throws, everything rolls back.
   */
  manager: EntityManager;

  /**
   * Convenience role assigner. Only available in afterRegister.
   * Accepts a role id (number) or role name (string).
   */
  assignRole?: (roleIdOrName: string | number) => Promise<void>;
}

export interface AuthRegisterHooks {
  beforeRegister?: RegisterHook;
  afterRegister?: RegisterHook;
}
