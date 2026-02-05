"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFilters = applyFilters;
function applyFilters(qb, filters, allowedFilters) {
    if (!filters)
        return;
    for (const [rawKey, value] of Object.entries(filters)) {
        const [field, operator] = rawKey.split('_');
        if (!allowedFilters.includes(field))
            continue;
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
