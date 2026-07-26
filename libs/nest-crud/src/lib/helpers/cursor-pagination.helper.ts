import { SelectQueryBuilder, Repository } from 'typeorm';
import {
  CursorStrategy,
  DecodedCursor,
  DecodedIntegerCursor,
  DecodedUuidCursor,
} from '../interfaces/cursor-strategy.interface';

// ─── Base64-URL helpers ──────────────────────────────────────────────

export function base64UrlEncode(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(raw: string): Record<string, unknown> {
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((raw.length + 3) % 4);
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

// ─── Cursor decode / validate ─────────────────────────────────────────

export function decodeCursor(raw: string, strategy: CursorStrategy): DecodedCursor {
  let parsed: Record<string, unknown>;
  try {
    parsed = base64UrlDecode(raw);
  } catch {
    throw new Error('Invalid cursor format');
  }

  if (strategy.type === 'integer') {
    if (typeof parsed.id !== 'number') {
      throw new Error('Invalid integer cursor: missing numeric id');
    }
    return { type: 'integer', id: parsed.id } satisfies DecodedIntegerCursor;
  }

  // UUID / composite cursor
  const tsCol = strategy.timestampColumn ?? 'createdAt';
  if (typeof parsed[tsCol] !== 'string' || typeof parsed.id !== 'string') {
    throw new Error(`Invalid UUID cursor: missing ${tsCol} or id`);
  }
  return {
    type: 'uuid',
    createdAt: parsed[tsCol] as string,
    id: parsed.id as string,
  } satisfies DecodedUuidCursor;
}

// ─── Query-builder mutations ──────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export function applyCursorFilter(
  qb: SelectQueryBuilder<any>,
  decoded: DecodedCursor,
  strategy: CursorStrategy,
  orderDirection: 'ASC' | 'DESC',
): void {
  // DESC order means "next page" goes to lower IDs → `< :cursorId`
  // ASC  order means "next page" goes to higher IDs → `> :cursorId`
  const comparator = orderDirection === 'DESC' ? '<' : '>';

  if (decoded.type === 'integer') {
    qb.andWhere(`${qb.expressionMap.mainAlias!.name}.id ${comparator} :cursorId`, {
      cursorId: decoded.id,
    });
    return;
  }

  // UUID composite cursor: (col1, col2) < (val1, val2)
  const alias = qb.expressionMap.mainAlias!.name;
  const tsCol = strategy.timestampColumn ?? 'createdAt';

  qb.andWhere(
    `(${alias}.${tsCol}, ${alias}.id) ${comparator} (:cursorTs, :cursorId)`,
    { cursorTs: decoded.createdAt, cursorId: decoded.id },
  );
}

// ─── Build next cursor from result set ────────────────────────────────

export function buildNextCursor<T extends Record<string, unknown>>(
  entities: T[],
  strategy: CursorStrategy,
): string | null {
  if (entities.length === 0) return null;

  const last = entities[entities.length - 1];

  if (strategy.type === 'integer') {
    return base64UrlEncode({ id: Number(last['id']) });
  }

  const tsCol = strategy.timestampColumn ?? 'createdAt';
  return base64UrlEncode({
    [tsCol]: String(last[tsCol]),
    id: String(last['id']),
  });
}

// ─── Detect strategy from repository metadata ─────────────────────────

export function detectCursorStrategy(
  repository: Repository<any>,
): CursorStrategy {
  const primaryColumn = repository.metadata.primaryColumns[0];

  if (!primaryColumn) {
    return { type: 'integer' };
  }

  const typeValue = primaryColumn.type;

  // Handle both () => String and String constructor patterns
  const typeName =
    typeof typeValue === 'function'
      ? typeValue.name
      : String(typeValue);

  if (typeName === 'String') {
    return { type: 'uuid' };
  }

  return { type: 'integer' };
}
