import {
  ApprovalStatus,
  ApprovalStatusView,
  ModificationItem,
} from './approval-pipeline.interface';
import { OwnershipUser } from './find-mine.interface';

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

export interface ApprovalHookContext {
  id: number;
  user?: OwnershipUser;
  approval: ApprovalStatusView;
}

export interface AfterApprovalHookContext extends ApprovalHookContext {
  previousStatus: ApprovalStatus;
}

export interface RequestModificationApprovalHookContext
  extends ApprovalHookContext {
  modifications: ModificationItem[];
  note?: string;
}

export interface AfterRequestModificationApprovalHookContext
  extends RequestModificationApprovalHookContext {
  previousStatus: ApprovalStatus;
}

export interface ApprovalHooks {
  beforeSubmit?: CrudHookConfig<ApprovalHookContext>;
  afterSubmit?: CrudHookConfig<AfterApprovalHookContext>;
  beforeApprove?: CrudHookConfig<ApprovalHookContext>;
  afterApprove?: CrudHookConfig<AfterApprovalHookContext>;
  beforeReject?: CrudHookConfig<ApprovalHookContext>;
  afterReject?: CrudHookConfig<AfterApprovalHookContext>;
  beforeRequestModification?: CrudHookConfig<RequestModificationApprovalHookContext>;
  afterRequestModification?: CrudHookConfig<AfterRequestModificationApprovalHookContext>;
  beforeResubmit?: CrudHookConfig<ApprovalHookContext>;
  afterResubmit?: CrudHookConfig<AfterApprovalHookContext>;
}
