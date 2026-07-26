/**
 * Determines how the cursor-based WHERE clause is built.
 *
 * - 'integer': simple `id > :cursorId` (for auto-increment integer PKs)
 * - 'uuid':    composite `(createdAt, id) < (cursorCreatedAt, cursorId)` (for UUID PKs)
 */
export type CursorStrategyType = 'integer' | 'uuid';

export interface CursorStrategy {
  type: CursorStrategyType;

  /**
   * The name of the timestamp column used in composite cursors.
   * Only required when type === 'uuid'.
   * Defaults to 'createdAt'.
   */
  timestampColumn?: string;
}

/**
 * Resolved cursor values after decoding.
 */
export interface DecodedIntegerCursor {
  type: 'integer';
  id: number;
}

export interface DecodedUuidCursor {
  type: 'uuid';
  createdAt: string; // ISO-8601
  id: string;
}

export type DecodedCursor = DecodedIntegerCursor | DecodedUuidCursor;
