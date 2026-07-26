import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface FindMineConfig<TEntity extends ObjectLiteral> {
  userOwnershipField?: keyof TEntity;
  findMineQuery?: (qb: SelectQueryBuilder<TEntity>, userId: string | number) => void;
}
