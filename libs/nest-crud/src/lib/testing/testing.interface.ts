import { Type } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { CrudServiceOptions } from '../services/nest-crud.service';
import { CrudEndpoint } from '../interfaces/crud.interface';

export interface CrudTestConfig<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto
> {
  entity: Type<TEntity>;
  serviceClass: Type<any>;
  createDto?: Type<TCreateDto>;
  updateDto?: Type<TUpdateDto>;
  responseDto?: Type<TResponseDto>;
  allowedFilters?: readonly (keyof TEntity | (string & {}))[];
  allowedSortFields?: readonly (keyof TEntity | (string & {}))[];
  include?: readonly string[];
  userOwnershipField?: keyof TEntity;
  findMineQuery?: (qb: any, userId: string | number) => void;
  disabledEndpoints?: readonly CrudEndpoint[];
  hooks?: CrudServiceOptions<TEntity, TResponseDto>['hooks'];
  toResponseDto?: (
    entity: TEntity | TEntity[]
  ) => TResponseDto | TResponseDto[];
  relations?: CrudServiceOptions<TEntity, TResponseDto>['relations'];
  test: {
    createPayload: Partial<TCreateDto>;
    updatePayload: Partial<TUpdateDto>;
    mockEntity?: Partial<TEntity>;
    mockEntities?: TEntity[];
    mockRepoOverrides?: Partial<jest.Mocked<Repository<TEntity>>>;
  };
}

export interface CrudControllerTestConfig<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto
> extends Omit<
    CrudTestConfig<TEntity, TCreateDto, TUpdateDto, TResponseDto>,
    'serviceClass'
  > {
  controllerFactory: () => Type<any>;
  serviceClass: Type<any>;
  permissions?: Record<CrudEndpoint, string | string[]>;
  authOptions?: Record<string, unknown>;
}

export interface CrudTestContext {
  module: any;
  repository: jest.Mocked<any>;
  createMockQb: () => MockQueryBuilder;
}

export interface MockQueryBuilder {
  where: jest.Mock;
  andWhere: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  leftJoin: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  getMany: jest.Mock;
  getOne: jest.Mock;
  getCount: jest.Mock;
  getRawOne: jest.Mock;
}
