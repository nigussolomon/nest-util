import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../dtos/pagination.dto';

export function applyPagination<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  query: PaginationDto
) {
  const { page, limit } = query;

  if (!page || !limit) {
    return null;
  }

  const skip = (page - 1) * limit;

  qb.skip(skip).take(limit);

  return {
    page,
    limit,
  };
}
