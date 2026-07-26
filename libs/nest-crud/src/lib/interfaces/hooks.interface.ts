export type CrudHook<TContext = any> = (context: TContext) => Promise<any> | any;

export interface CrudHookConfig<TContext = any> {
  handler: CrudHook<TContext>;
  transaction?: boolean;
}

export interface BeforeCreateContext<TEntity, TCreateDto> {
  payload: TCreateDto;
}

export interface AfterCreateContext<TEntity, TCreateDto> {
  entity: TEntity;
  payload: TCreateDto;
}

export interface BeforeUpdateContext<TEntity, TUpdateDto> {
  payload: TUpdateDto;
  entity: TEntity;
  id: number;
}

export interface AfterUpdateContext<TEntity, TUpdateDto> {
  entity: TEntity;
  payload: TUpdateDto;
  id: number;
}

export interface BeforeRemoveContext<TEntity> {
  entity: TEntity;
  id: number;
}

export interface AfterRemoveContext {
  id: number;
  deleted: boolean;
}

export interface BeforeFindOneContext {
  id: number;
}

export interface AfterFindOneContext<TEntity> {
  entity: TEntity;
  id: number;
}

export interface CrudHooks<TEntity, TCreateDto, TUpdateDto> {
  beforeCreate?: CrudHookConfig<BeforeCreateContext<TEntity, TCreateDto>>;
  afterCreate?: CrudHookConfig<AfterCreateContext<TEntity, TCreateDto>>;
  beforeUpdate?: CrudHookConfig<BeforeUpdateContext<TEntity, TUpdateDto>>;
  afterUpdate?: CrudHookConfig<AfterUpdateContext<TEntity, TUpdateDto>>;
  beforeRemove?: CrudHookConfig<BeforeRemoveContext<TEntity>>;
  afterRemove?: CrudHookConfig<AfterRemoveContext>;
  beforeFindOne?: CrudHookConfig<BeforeFindOneContext>;
  afterFindOne?: CrudHookConfig<AfterFindOneContext<TEntity>>;
}

export interface TransactionConfig {
  isolationLevel?:
    | 'READ UNCOMMITTED'
    | 'READ COMMITTED'
    | 'REPEATABLE READ'
    | 'SERIALIZABLE';
  timeout?: number;
}
