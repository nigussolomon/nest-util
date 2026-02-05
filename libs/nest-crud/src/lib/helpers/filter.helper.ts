import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function applyFilters<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  filters: Record<string, unknown> | undefined,
  allowedFilters: readonly (keyof Entity)[]
): void {
  if (!filters) return;

  for (const [rawKey, value] of Object.entries(filters)) {
    const [field, operator] = rawKey.split('_');

    if (!allowedFilters.includes(field as keyof Entity)) continue;

    const paramKey = `${field}_${operator}`;

    switch (operator) {
      case 'eq':
        qb.andWhere(`e.${field} = :${paramKey}`, { [paramKey]: value });
        break;

      case 'cont':
        qb.andWhere(`e.${field} ILIKE :${paramKey}`, {
          [paramKey]: `%${value}%`,
        });
        break;

      case 'gte':
        qb.andWhere(`e.${field} >= :${paramKey}`, { [paramKey]: value });
        break;

      case 'lte':
        qb.andWhere(`e.${field} <= :${paramKey}`, { [paramKey]: value });
        break;
    }
  }
}
