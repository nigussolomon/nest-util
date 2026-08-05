import { OwnershipUser } from './find-mine.interface';

export type StatusValue = string | number;

/**
 * Context passed to a status transition action. The transition has already
 * been validated and persisted (`entity` reflects the new status) when the
 * action runs.
 */
export interface StatusTransitionContext<TEntity extends Record<string, unknown>> {
  id: number;
  entity: TEntity;
  from: StatusValue;
  to: StatusValue;
  user?: OwnershipUser;
}

/**
 * Callback that runs after a status transition is saved. May be async and is
 * awaited. Edge actions run before the pipeline-level `onTransition`.
 */
export type StatusTransitionAction<TEntity extends Record<string, unknown>> = (
  context: StatusTransitionContext<TEntity>
) => void | Promise<void>;

/**
 * A single allowed transition edge. When `permission` is set, the caller must
 * have that permission in their resolved permissions to perform the
 * transition. When `action` is set, it runs after the transition is saved.
 */
export interface StatusTransitionEdge<TEntity extends Record<string, unknown>> {
  from: StatusValue;
  to: readonly StatusValue[];
  permission?: string;
  action?: StatusTransitionAction<TEntity>;
}

/**
 * Allowed status transitions, provided either as a simple map
 * ({ pending: ['approved', 'rejected'] }) or as an array of edges that can
 * optionally carry per-transition permissions and actions.
 */
export type StatusTransitions<TEntity extends Record<string, unknown>> =
  | Record<StatusValue, readonly StatusValue[]>
  | readonly StatusTransitionEdge<TEntity>[];

export interface StatusPipelineConfig<TEntity extends Record<string, unknown>> {
  /**
   * The column on the entity that holds the status value, e.g. 'status'.
   */
  field: keyof TEntity;

  /**
   * Directed graph of allowed transitions. A transition not listed here is
   * rejected. This covers both upgrades (pending -> approved) and controlled
   * downgrades (approved -> pending) — only explicitly allowed moves pass.
   */
  transitions: StatusTransitions<TEntity>;

  /**
   * Status applied on create when the payload omits the status field.
   */
  initial?: StatusValue;

  /**
   * Statuses a create payload may set directly. Defaults to [initial].
   */
  allowCreateStatuses?: readonly StatusValue[];

  /**
   * Global action that runs after every successful status transition, after
   * any edge-specific `action`. Useful for cross-cutting concerns such as
   * audit logging of every transition.
   */
  onTransition?: StatusTransitionAction<TEntity>;
}
