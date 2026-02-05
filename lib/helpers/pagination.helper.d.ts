import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../dtos/pagination.dto';
export declare function applyPagination<Entity extends ObjectLiteral>(qb: SelectQueryBuilder<Entity>, query: PaginationDto): {
    page: number;
    limit: number;
} | null;
//# sourceMappingURL=pagination.helper.d.ts.map