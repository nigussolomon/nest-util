import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
export declare function applyFilters<Entity extends ObjectLiteral>(qb: SelectQueryBuilder<Entity>, filters: Record<string, unknown> | undefined, allowedFilters: readonly (keyof Entity)[]): void;
//# sourceMappingURL=filter.helper.d.ts.map