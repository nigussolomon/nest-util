import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

type FilterGroup = Record<string, unknown>;

type FilterCombinator = 'and' | 'or';
const SAFE_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

const toArrayValue = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return value === undefined || value === null ? [] : [value];
};

const toBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  return null;
};

const parseFilterKey = (
  rawKey: string
): { field: string; operator: string } | null => {
  const separatorIndex = rawKey.lastIndexOf('_');
  if (separatorIndex <= 0 || separatorIndex === rawKey.length - 1) return null;

  const field = rawKey.slice(0, separatorIndex);
  const operator = rawKey.slice(separatorIndex + 1).toLowerCase();

  return { field, operator };
};

const buildCondition = (
  field: string,
  operator: string,
  value: unknown,
  paramIndex: { current: number }
): { sql: string; params?: Record<string, unknown> } | null => {
  const paramKey = `filter_${paramIndex.current++}`;

  switch (operator) {
    case 'eq':
      return { sql: `e.${field} = :${paramKey}`, params: { [paramKey]: value } };

    case 'ne':
      return { sql: `e.${field} != :${paramKey}`, params: { [paramKey]: value } };

    case 'cont':
      return {
        sql: `e.${field} ILIKE :${paramKey}`,
        params: { [paramKey]: `%${value}%` },
      };

    case 'notcont':
      return {
        sql: `e.${field} NOT ILIKE :${paramKey}`,
        params: { [paramKey]: `%${value}%` },
      };

    case 'starts':
      return {
        sql: `e.${field} ILIKE :${paramKey}`,
        params: { [paramKey]: `${value}%` },
      };

    case 'ends':
      return {
        sql: `e.${field} ILIKE :${paramKey}`,
        params: { [paramKey]: `%${value}` },
      };

    case 'gte':
      return { sql: `e.${field} >= :${paramKey}`, params: { [paramKey]: value } };

    case 'lte':
      return { sql: `e.${field} <= :${paramKey}`, params: { [paramKey]: value } };

    case 'gt':
      return { sql: `e.${field} > :${paramKey}`, params: { [paramKey]: value } };

    case 'lt':
      return { sql: `e.${field} < :${paramKey}`, params: { [paramKey]: value } };

    case 'in':
    case 'nin': {
      const values = toArrayValue(value);
      if (values.length === 0) return null;

      return {
        sql:
          operator === 'in'
            ? `e.${field} IN (:...${paramKey})`
            : `e.${field} NOT IN (:...${paramKey})`,
        params: { [paramKey]: values },
      };
    }

    case 'isnull': {
      const isNull = toBooleanValue(value);
      if (isNull === null) return null;

      return { sql: isNull ? `e.${field} IS NULL` : `e.${field} IS NOT NULL` };
    }

    default:
      return null;
  }
};

const buildExpression = (
  node: unknown,
  combinator: FilterCombinator,
  allowedFilters: readonly string[],
  paramIndex: { current: number },
  params: Record<string, unknown>
): string | null => {
  if (!node || typeof node !== 'object') return null;

  const conditions: string[] = [];
  const entries = Array.isArray(node)
    ? node.map((item, index) => [String(index), item] as const)
    : Object.entries(node);

  for (const [rawKey, value] of entries) {
    if (rawKey === 'and' || rawKey === 'or') {
      const nestedCombinator = rawKey;
      const nestedNodes = Array.isArray(value) ? value : [value];
      const nestedExpressions = nestedNodes
        .map((nestedNode) =>
          buildExpression(
            nestedNode,
            'and',
            allowedFilters,
            paramIndex,
            params
          )
        )
        .filter((sql): sql is string => Boolean(sql));

      if (nestedExpressions.length > 0) {
        conditions.push(`(${nestedExpressions.join(` ${nestedCombinator.toUpperCase()} `)})`);
      }

      continue;
    }

    const parsed = parseFilterKey(rawKey);
    if (!parsed) continue;

    const { field, operator } = parsed;

    if (!SAFE_FIELD_PATTERN.test(field)) continue;
    if (!allowedFilters.includes(field)) continue;

    const condition = buildCondition(field, operator, value, paramIndex);
    if (!condition) continue;

    if (condition.params) Object.assign(params, condition.params);
    conditions.push(condition.sql);
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];

  return `(${conditions.join(` ${combinator.toUpperCase()} `)})`;
};

export function applyFilters<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  filters: Record<string, unknown> | undefined,
  allowedFilters: readonly (keyof Entity)[]
): void {
  if (!filters) return;

  const params: Record<string, unknown> = {};
  const expression = buildExpression(
    filters as FilterGroup,
    'and',
    allowedFilters.map(String),
    { current: 0 },
    params
  );

  if (!expression) return;

  if (Object.keys(params).length > 0) {
    qb.andWhere(expression, params);
    return;
  }

  qb.andWhere(expression);
}
