import type { ApprovalHooks } from './hooks.interface';

/**
 * Lifecycle of an approval status row.
 *
 *   draft ──> submitted ────────> approved
 *      │        │  └────────────> rejected
 *      │        └─> modification_requested ──> resubmitted ──> approved / rejected
 *                 │                                    │
 *                 └────────────────────────────────────┘
 *               (modifications may be requested again)
 */
export const APPROVAL_STATUS = {
  draft: 'draft',
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  modificationRequested: 'modification_requested',
  resubmitted: 'resubmitted',
} as const;

export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

/**
 * A single requested modification on a record under review. Each item names the
 * field to change and the value the reviewer wants instead.
 */
export interface ModificationItem {
  /** Entity field to modify, e.g. 'title' or 'category' (a relation). */
  field: string;
  /**
   * Value currently stored on the record. Auto-captured from the live entity
   * when omitted (supports relation objects; circular refs are sanitized to
   * '[Circular]').
   */
  currentValue?: unknown;
  /** Value the reviewer wants instead. */
  wantedValue: unknown;
  /** Optional human-readable explanation. */
  note?: string;
}

export interface ApprovalStatusView {
  id: number;
  entity: string;
  entityId: string;
  status: ApprovalStatus;
  requestedBy?: string | null;
  requestedAt: Date;
  currentModifications?: ModificationItem[] | null;
  decidedBy?: string | null;
  decidedAt?: Date | null;
  resubmittedBy?: string | null;
  resubmittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalHistoryView {
  id: number;
  approvalStatusId: number;
  modifications: ModificationItem[];
  requestedBy?: string | null;
  requestedAt: Date;
  note?: string | null;
}

export interface ApprovalPipelinePermissions {
  /** Required permission to approve (submitted/resubmitted -> approved). */
  approve?: string;
  /** Required permission to reject (submitted/resubmitted -> rejected). */
  reject?: string;
  /** Required permission to request modifications. */
  requestModification?: string;
  /** Required permission to resubmit after modifications. */
  resubmit?: string;
  /** Required permission to submit a draft for approval. */
  submit?: string;
}

export interface ApprovalPipelineConfig {
  /**
   * When true, every created record also gets a draft approval status row
   * (created in the same transaction). Defaults to true when the option is
   * provided.
   */
  enabled?: boolean;

  /**
   * Initial status assigned to a record's approval row on create.
   *  - 'draft'    (default): the record waits in draft until `submitApproval`
   *    is called; the `submit` permission applies and `requestedBy` is filled
   *    on submit.
   *  - 'submitted': the record is created already in the reviewable state
   *    (the creating user becomes the requester), so no explicit submit step
   *    is needed.
   */
  initialStatus?: 'draft' | 'submitted';

  /**
   * Optional permission strings required to perform each action. When unset,
   * the action is allowed for any authenticated (or anonymous) caller.
   */
  permissions?: ApprovalPipelinePermissions;

  /**
   * When set, read endpoints (findAll / findOne / findMine /
   * findAllWithCursor) only return records whose approval status is in this
   * list, e.g. ['approved']. When unset, all records are visible regardless
   * of approval state.
   */
  visibleStatuses?: readonly ApprovalStatus[];

  /**
   * Before/after hooks for each approval transition, mirroring the generic
   * `CrudHooks` API. Each hook receives the approval row view and (for
   * `after*`) the previous status.
   */
  hooks?: ApprovalHooks;
}

export interface RequestModificationPayload {
  modifications: ModificationItem[];
  note?: string;
}
