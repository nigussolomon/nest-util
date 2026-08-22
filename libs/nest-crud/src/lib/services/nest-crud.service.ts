import { Injectable, HttpStatus, Type } from '@nestjs/common';
import { keyed, ErrorKey } from '@nest-util/nest-error';
import { DeepPartial, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { applyFilters, resolveQueryTarget } from '../helpers/filter.helper';
import { PaginationDto } from '../dtos/pagination.dto';
import { CursorPaginationDto } from '../dtos/cursor-pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { applyPagination } from '../helpers/pagination.helper';
import { CrudEndpoint, CrudInterface, CursorPaginationResult } from '../interfaces/crud.interface';
import { CursorStrategy } from '../interfaces/cursor-strategy.interface';
import { CrudHookConfig, CrudHooks, TransactionConfig } from '../interfaces/hooks.interface';
import { FindMineConfig, OwnershipUser } from '../interfaces/find-mine.interface';
import {
  StatusPipelineConfig,
  StatusTransitions,
  StatusTransitionEdge,
  StatusTransitionAction,
  StatusTransitionContext,
  StatusValue,
} from '../interfaces/status-pipeline.interface';
import {
  applyCursorFilter,
  buildNextCursor,
  decodeCursor,
  detectCursorStrategy,
} from '../helpers/cursor-pagination.helper';
import { ApprovalStatusEntity } from '../entities/approval-status.entity';
import { ModificationRequestHistoryEntity } from '../entities/modification-request-history.entity';
import {
  APPROVAL_STATUS,
  ApprovalPipelineConfig,
  ApprovalStatus,
  ApprovalStatusView,
  ApprovalHistoryView,
  ModificationItem,
  RequestModificationPayload,
} from '../interfaces/approval-pipeline.interface';

export interface CrudServiceOptions<Entity extends ObjectLiteral, ResponseDto>
  extends FindMineConfig<Entity> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity | (string & {}))[];
  allowedSortFields?: readonly (keyof Entity | (string & {}))[];
  include?: readonly string[];
  relations?: {
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;
  }[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
  disabledEndpoints?: readonly CrudEndpoint[];
  cursorStrategy?: CursorStrategy;
  hooks?: CrudHooks<Entity, any, any>;
  transactionConfig?: TransactionConfig;
  statusPipeline?: StatusPipelineConfig<Entity>;
  approvalPipeline?: ApprovalPipelineConfig;
}

@Injectable()
export class NestCrudService<
  Entity extends ObjectLiteral,
  CreateDto = Partial<Entity>,
  UpdateDto = Partial<Entity>,
  ResponseDto = Entity
> implements CrudInterface<CreateDto, UpdateDto, ResponseDto>
{
  protected readonly repo: Repository<Entity>;
  protected readonly allowedFilters: readonly (keyof Entity | (string & {}))[];
  protected readonly allowedSortFields: readonly (keyof Entity | (string & {}))[];
  protected readonly include: readonly string[];
  protected readonly relations: {
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;
  }[];
  protected readonly toResponseDto?: (
    entity: Entity | Entity[]
  ) => ResponseDto | ResponseDto[];
  protected readonly createDtoClass?: Type<unknown>;
  protected readonly updateDtoClass?: Type<unknown>;
  readonly disabledEndpoints: readonly CrudEndpoint[];
  protected readonly cursorStrategy: CursorStrategy;
  protected readonly hooks: CrudHooks<Entity, any, any>;
  protected readonly transactionConfig: TransactionConfig;
  protected readonly userOwnershipField?: keyof Entity;
  protected readonly findMineQuery?: (qb: SelectQueryBuilder<Entity>, userId: string | number) => void;
  protected readonly enforceOwnership: boolean;
  protected readonly ownershipBypassPermissions: readonly string[];
  protected readonly ownershipBypass?: (user: OwnershipUser) => boolean;
  protected readonly superAdminPermission?: string;
  protected readonly statusField?: keyof Entity;
  protected readonly statusInitial?: StatusValue;
  protected readonly statusCreateAllow: readonly StatusValue[];
  protected readonly statusOnTransition?: StatusTransitionAction<Entity>;
  protected readonly statusTransitions: Map<
    StatusValue,
    {
      to: Set<StatusValue>;
      permission?: string;
      action?: StatusTransitionAction<Entity>;
    }
  > = new Map();
  protected readonly approvalPipeline?: ApprovalPipelineConfig;

  constructor(options: CrudServiceOptions<Entity, ResponseDto>) {
    this.repo = options.repository;
    this.allowedFilters = options.allowedFilters ?? [];
    this.allowedSortFields = options.allowedSortFields ?? [];
    this.include = options.include ?? [];
    this.relations = options.relations ?? [];
    this.toResponseDto = options.toResponseDto;
    this.createDtoClass = options.createDtoClass;
    this.updateDtoClass = options.updateDtoClass;
    this.disabledEndpoints = options.disabledEndpoints ?? [];
    this.cursorStrategy =
      options.cursorStrategy ?? detectCursorStrategy(this.repo);
    this.hooks = options.hooks ?? {};
    this.transactionConfig = options.transactionConfig ?? {};
    this.userOwnershipField = options.userOwnershipField;
    this.findMineQuery = options.findMineQuery;
    this.enforceOwnership = options.enforceOwnership ?? false;
    this.ownershipBypassPermissions = options.ownershipBypassPermissions ?? [];
    this.ownershipBypass = options.ownershipBypass;
    this.superAdminPermission = options.superAdminPermission;
    this.statusField = options.statusPipeline?.field;
    this.statusInitial = options.statusPipeline?.initial;
    this.statusOnTransition = options.statusPipeline?.onTransition;
    this.statusCreateAllow = [
      ...(options.statusPipeline?.initial !== undefined
        ? [options.statusPipeline.initial]
        : []),
      ...(options.statusPipeline?.allowCreateStatuses ?? []),
    ];
    if (options.statusPipeline?.transitions) {
      this.statusTransitions = this.normalizeStatusTransitions(
        options.statusPipeline.transitions
      );
    }
    this.approvalPipeline = options.approvalPipeline;
  }

  private normalizeStatusTransitions(
    transitions: StatusTransitions<Entity>
  ): Map<
    StatusValue,
    {
      to: Set<StatusValue>;
      permission?: string;
      action?: StatusTransitionAction<Entity>;
    }
  > {
    const result = new Map<
      StatusValue,
      {
        to: Set<StatusValue>;
        permission?: string;
        action?: StatusTransitionAction<Entity>;
      }
    >();

    const addEdge = (
      from: StatusValue,
      to: readonly StatusValue[],
      permission?: string,
      action?: StatusTransitionAction<Entity>
    ) => {
      const existing = result.get(from) ?? {
        to: new Set<StatusValue>(),
        permission: undefined,
        action: undefined,
      };
      for (const target of to) {
        existing.to.add(target);
      }
      if (permission !== undefined) {
        existing.permission = permission;
      }
      if (action !== undefined) {
        existing.action = action;
      }
      result.set(from, existing);
    };

    if (Array.isArray(transitions)) {
      for (const edge of transitions as readonly StatusTransitionEdge<Entity>[]) {
        addEdge(edge.from, edge.to, edge.permission, edge.action);
      }
    } else {
      for (const [from, to] of Object.entries(transitions)) {
        addEdge(from, to);
      }
    }

    return result;
  }

  private async resolveRelations<T extends ObjectLiteral>(
    payload: T
  ): Promise<T> {
    if (!this.relations.length) return payload;

    for (const relation of this.relations) {
      const idField = relation.idField ?? `${String(relation.property)}Id`;

      if (!(idField in payload)) continue;

      const id = payload[idField as keyof T];
      if (!id) continue;

      const entity = await relation.repo.findOneBy({
        id,
      } as unknown as Partial<ObjectLiteral>);

      if (!entity) {
        throw keyed(
        HttpStatus.NOT_FOUND,
        ErrorKey.CRUD_RELATION_NOT_FOUND,
        { property: String(relation.property) }
      );
      }

      (payload as unknown as Record<string, unknown>)[
        String(relation.property)
      ] = entity;

      delete (payload as unknown as Record<string, unknown>)[idField];
    }

    return payload;
  }

  private async executeInTransaction<T>(
    fn: () => Promise<T>,
    isolationLevel?: string
  ): Promise<T> {
    const queryRunner = this.repo.manager.connection.createQueryRunner();
    await queryRunner.startTransaction(
      isolationLevel as 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'
    );
    try {
      const result = await fn();
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async executeHook<TContext>(
    hook: CrudHookConfig<TContext> | undefined,
    context: TContext
  ): Promise<void> {
    if (!hook) return;
    if (hook.transaction) {
      await this.executeInTransaction(
        () => hook.handler(context),
        this.transactionConfig?.isolationLevel
      );
    } else {
      await hook.handler(context);
    }
  }

  private buildRelationsObject(relations: readonly string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const relation of relations) {
      const parts = relation.split('.');
      let current = result;
      for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        if (isLast) {
          current[parts[i]] = true;
        } else {
          if (!(parts[i] in current) || current[parts[i]] === true) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
      }
    }
    return result;
  }

  private applyIncludeJoins(
    qb: SelectQueryBuilder<Entity>,
    withSelect = true
  ): void {
    if (this.include.length === 0) return;

    const join = withSelect
      ? (path: string, alias: string) => qb.leftJoinAndSelect(path, alias)
      : (path: string, alias: string) => qb.leftJoin(path, alias);

    this.include.forEach((relation) => {
      const parts = relation.split('.');
      if (parts.length === 1) {
        join(`e.${parts[0]}`, parts[0]);
      } else {
        const parentAlias = parts.slice(0, -1).join('_');
        const field = parts[parts.length - 1];
        const alias = parts.join('_');
        join(`${parentAlias}.${field}`, alias);
      }
    });
  }

  private applyOrderBy(
    qb: SelectQueryBuilder<Entity>,
    orderBy: string | undefined,
    orderDirection: 'ASC' | 'DESC'
  ): void {
    if (!orderBy) return;

    const target = resolveQueryTarget(
      orderBy,
      this.include.map(String),
      'e'
    );
    if (!target) return;

    if (
      this.allowedSortFields.length === 0 ||
      this.allowedSortFields.includes(orderBy as keyof Entity)
    ) {
      qb.orderBy(target, orderDirection);
    }
  }

  private isOwnershipConfigured(): boolean {
    return Boolean(this.userOwnershipField || this.findMineQuery);
  }

  private resolveUserPermissions(user: OwnershipUser): string[] {
    const out = new Set<string>();
    const add = (value: unknown) => {
      if (Array.isArray(value)) {
        value
          .filter((item): item is string => typeof item === 'string')
          .forEach((permission) => out.add(permission));
      }
    };

    add(user.permissions);

    for (const rolesKey of ['userRoles', 'roles']) {
      const rows = user[rolesKey];
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const roleLike = row as Record<string, unknown>;
        add(roleLike.permissions);
        const nested = roleLike.role;
        if (nested && typeof nested === 'object') {
          add((nested as Record<string, unknown>).permissions);
        }
      }
    }

    return [...out];
  }

  private canBypassOwnership(user?: OwnershipUser): boolean {
    if (!user) return false;

    if (this.superAdminPermission) {
      const resolved = this.resolveUserPermissions(user);
      if (resolved.includes(this.superAdminPermission)) {
        return true;
      }
    }

    if (this.ownershipBypass && this.ownershipBypass(user)) {
      return true;
    }

    if (this.ownershipBypassPermissions.length > 0) {
      const userPermissions = this.resolveUserPermissions(user);
      return this.ownershipBypassPermissions.some((permission) =>
        userPermissions.includes(permission)
      );
    }

    return false;
  }

  private enforceOwnershipFor(user?: OwnershipUser): boolean {
    return Boolean(
      this.enforceOwnership &&
        this.isOwnershipConfigured() &&
        !this.canBypassOwnership(user)
    );
  }

  private applyOwnershipCondition(
    qb: SelectQueryBuilder<Entity>,
    userId: string | number
  ): void {
    if (this.findMineQuery) {
      this.findMineQuery(qb, userId);
    } else if (this.userOwnershipField) {
      qb.where(`e.${String(this.userOwnershipField)} = :userId`, { userId });
    }
  }

  private async findOwnedEntity(
    id: number,
    user: OwnershipUser
  ): Promise<Entity | null> {
    const userId = user?.id;

    if (userId === undefined || userId === null) {
      throw keyed(HttpStatus.FORBIDDEN, ErrorKey.AUTH_UNAUTHORIZED);
    }

    const qb = this.repo.createQueryBuilder('e');
    this.applyOwnershipCondition(qb, userId);
    qb.andWhere('e.id = :id', { id });
    this.applyIncludeJoins(qb);

    const rows = await qb.getMany();
    return rows[0] ?? null;
  }

  private isStatusPipelineConfigured(): boolean {
    return Boolean(this.statusField);
  }

  private applyInitialStatus(payload: Record<string, unknown>): void {
    if (!this.isStatusPipelineConfigured()) {
      return;
    }

    const field = String(this.statusField);
    const requested = payload[field];

    if (requested === undefined) {
      if (this.statusInitial !== undefined) {
        payload[field] = this.statusInitial;
      }
      return;
    }

    if (
      this.statusCreateAllow.length > 0 &&
      !this.statusCreateAllow.includes(requested as StatusValue)
    ) {
      throw keyed(
        HttpStatus.BAD_REQUEST,
        ErrorKey.CRUD_INVALID_STATUS,
        { requested: String(requested) }
      );
    }
  }

  private validateStatusTransition(
    existing: Entity,
    payload: Record<string, unknown>,
    user?: OwnershipUser
  ): { from: StatusValue; to: StatusValue; action?: StatusTransitionAction<Entity> } | null {
    if (!this.isStatusPipelineConfigured()) {
      return null;
    }

    const field = String(this.statusField);
    const requested = payload[field];

    if (requested === undefined) {
      return null;
    }

    const current = (existing as unknown as Record<string, unknown>)[field];
    const requestedValue = requested as StatusValue;

    if (current === requestedValue) {
      return null;
    }

    const entry = this.statusTransitions.get(current as StatusValue);

    if (!entry) {
      throw keyed(
        HttpStatus.BAD_REQUEST,
        ErrorKey.CRUD_STATUS_TRANSITION_INVALID,
        { from: String(current), to: String(requestedValue) }
      );
    }

    if (!entry.to.has(requestedValue)) {
      throw keyed(
        HttpStatus.BAD_REQUEST,
        ErrorKey.CRUD_STATUS_TRANSITION_INVALID,
        { from: String(current), to: String(requestedValue) }
      );
    }

    if (entry.permission && !this.canBypassOwnershipForTransition(user, entry.permission)) {
      throw keyed(
        HttpStatus.FORBIDDEN,
        ErrorKey.CRUD_STATUS_TRANSITION_FORBIDDEN,
        { permission: entry.permission }
      );
    }

    return {
      from: current as StatusValue,
      to: requestedValue,
      action: entry.action,
    };
  }

  private async runTransitionActions(
    transition: { from: StatusValue; to: StatusValue; action?: StatusTransitionAction<Entity> },
    id: number,
    entity: Entity,
    user?: OwnershipUser
  ): Promise<void> {
    const context: StatusTransitionContext<Entity> = {
      id,
      entity,
      from: transition.from,
      to: transition.to,
      user,
    };

    if (transition.action) {
      await transition.action(context);
    }

    if (this.statusOnTransition) {
      await this.statusOnTransition(context);
    }
  }

  private canBypassOwnershipForTransition(
    user: OwnershipUser | undefined,
    permission: string
  ): boolean {
    if (!user) return false;
    return this.resolveUserPermissions(user).includes(permission);
  }

  async findAll(query: PaginationDto & FilterDto) {
    const qb = this.repo.createQueryBuilder('e');

    this.applyIncludeJoins(qb);

    this.applyApprovalVisibility(qb);

    applyFilters(qb, query.filter, this.allowedFilters, this.include);

    const paginationMeta = applyPagination(qb, query);

    this.applyOrderBy(
      qb,
      query.orderBy,
      query.orderDirection === 'ASC' ? 'ASC' : 'DESC'
    );

    const [entities, total] = await qb.getManyAndCount();

    const data = this.toResponseDto
      ? (this.toResponseDto(entities) as ResponseDto[])
      : (entities as unknown as ResponseDto[]);

    return paginationMeta
      ? { data, meta: { ...paginationMeta, total } }
      : { data };
  }

  async findMine(
    userId: string | number,
    query: PaginationDto & FilterDto
  ): Promise<{ data: ResponseDto[]; meta?: unknown }> {
    if (!this.userOwnershipField && !this.findMineQuery) {
      throw keyed(HttpStatus.BAD_REQUEST, ErrorKey.CRUD_FIND_MINE_NOT_CONFIGURED);
    }

    const qb = this.repo.createQueryBuilder('e');

    this.applyOwnershipCondition(qb, userId);

    this.applyIncludeJoins(qb);

    this.applyApprovalVisibility(qb);

    applyFilters(qb, query.filter, this.allowedFilters, this.include);

    const paginationMeta = applyPagination(qb, query);

    this.applyOrderBy(
      qb,
      query.orderBy,
      query.orderDirection === 'ASC' ? 'ASC' : 'DESC'
    );

    const [entities, total] = await qb.getManyAndCount();

    const data = this.toResponseDto
      ? (this.toResponseDto(entities) as ResponseDto[])
      : (entities as unknown as ResponseDto[]);

    return paginationMeta
      ? { data, meta: { ...paginationMeta, total } }
      : { data };
  }

  async findAllWithCursor(
    query: CursorPaginationDto & FilterDto
  ): Promise<CursorPaginationResult<ResponseDto>> {
    const limit = query.limit ?? 10;
    const strategy = this.cursorStrategy;
    const orderDirection = 'DESC';

    const qb = this.repo.createQueryBuilder('e');

    // Join relations
    this.applyIncludeJoins(qb);

    this.applyApprovalVisibility(qb);

    // Apply filters
    applyFilters(qb, query.filter, this.allowedFilters, this.include);

    // Apply cursor filter
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor, strategy);
      applyCursorFilter(qb, decoded, strategy, orderDirection);
    }

    // Default ordering by id
    qb.orderBy(`e.id`, orderDirection);

    // Fetch limit + 1 to detect hasMore
    const take = limit + 1;
    const entities = await qb.take(take).getMany();

    const hasMore = entities.length > limit;
    const data = hasMore ? entities.slice(0, limit) : entities;

    // Build next cursor from last entity
    const nextCursor = hasMore ? buildNextCursor(data, strategy) : null;

    // Optionally compute total count
    let total: number | undefined;
    if (query.includeTotal) {
      // Build a clean count query (reuse same filters but no cursor/order/take)
      const countQb = this.repo.createQueryBuilder('e');
      this.applyIncludeJoins(countQb, false);
      this.applyApprovalVisibility(countQb);
      applyFilters(countQb, query.filter, this.allowedFilters, this.include);
      total = await countQb.getCount();
    }

    const response = this.toResponseDto
      ? (this.toResponseDto(data) as ResponseDto[])
      : (data as unknown as ResponseDto[]);

    return {
      data: response,
      meta: {
        limit,
        hasMore,
        nextCursor,
        ...(total !== undefined ? { total } : {}),
      },
    };
  }

  async findOne(id: number, user?: OwnershipUser) {
    await this.executeHook(this.hooks.beforeFindOne, { id });

    let entity: Entity | null;

    if (this.enforceOwnershipFor(user)) {
      entity = await this.findOwnedEntity(id, user as OwnershipUser);
    } else if (this.hasApprovalVisibilityFilter()) {
      const qb = this.repo.createQueryBuilder('e');
      this.applyIncludeJoins(qb);
      this.applyApprovalVisibility(qb);
      qb.andWhere('e.id = :id', { id });
      entity = await qb.getOne();
    } else {
      const relationsObj = this.include.length > 0
        ? this.buildRelationsObject(this.include)
        : undefined;

      entity = await this.repo.findOne({
        where: { id } as unknown as Partial<Entity>,
        relations: relationsObj as any,
      });
    }

    if (!entity) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    }

    const result = this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);

    await this.executeHook(this.hooks.afterFindOne, { entity, id });

    return result;
  }

  async create(payload: CreateDto, user?: OwnershipUser) {
    if (
      this.enforceOwnership &&
      this.userOwnershipField &&
      !this.canBypassOwnership(user)
    ) {
      if (!user || user.id === undefined || user.id === null) {
        throw keyed(HttpStatus.FORBIDDEN, ErrorKey.AUTH_UNAUTHORIZED);
      }
      const field = String(this.userOwnershipField);
      const matchingRelation = this.relations.find(
        (r) => String(r.property) === field
      );

      // Determine which payload key holds the user-controlled value
      const targetKey = matchingRelation
        ? (matchingRelation.idField ?? `${field}Id`)
        : field;

      const payloadValue = (payload as Record<string, unknown>)[targetKey];

      if (payloadValue !== undefined && payloadValue !== null) {
        // Value present — must match the authenticated user
        if (String(payloadValue) !== String(user.id)) {
          throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
        }
      } else {
        // Value absent — auto-set to the authenticated user
        (payload as Record<string, unknown>)[targetKey] = user.id;
        if (matchingRelation) {
          (payload as Record<string, unknown>)[field] = user.id;
        }
      }
    }

    this.applyInitialStatus(payload as unknown as Record<string, unknown>);

    await this.executeHook(this.hooks.beforeCreate, { payload });

    const payloadSnapshot = { ...payload };
    const resolved = await this.resolveRelations(
      payload as unknown as ObjectLiteral
    );

    const entity = this.isApprovalPipelineConfigured()
      ? await this.createWithApproval(resolved, user)
      : await this.repo.save(resolved as unknown as Entity);

    const result = this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);

    await this.executeHook(this.hooks.afterCreate, { entity, payload: payloadSnapshot });

    return result;
  }

  async update(id: number, payload: UpdateDto, user?: OwnershipUser) {
    return this.applyUpdateCore(id, payload, user);
  }

  async changeStatus(
    id: number,
    status: StatusValue,
    user?: OwnershipUser
  ): Promise<ResponseDto> {
    if (!this.isStatusPipelineConfigured()) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_STATUS_NOT_CONFIGURED);
    }

    const payload = { [String(this.statusField)]: status } as unknown as UpdateDto;

    return this.applyUpdateCore(id, payload, user);
  }

  async getApproval(
    id: number,
    user?: OwnershipUser
  ): Promise<{ approval: ApprovalStatusView; history: ApprovalHistoryView[] }> {
    if (!this.isApprovalPipelineConfigured()) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_APPROVAL_NOT_CONFIGURED);
    }

    const approval = await this.loadApprovalStatus(id, user);

    if (!approval) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    }

    const history = await this.getHistoryRepository().find({
      where: { approvalStatusId: approval.id },
      order: { requestedAt: 'DESC' },
    });

    return {
      approval: this.toApprovalStatusView(approval),
      history: history.map((entry) => this.toApprovalHistoryView(entry)),
    };
  }

  async approveApproval(id: number, user?: OwnershipUser): Promise<ApprovalStatusView> {
    return this.transitionApproval(id, 'approve', user);
  }

  async rejectApproval(id: number, user?: OwnershipUser): Promise<ApprovalStatusView> {
    return this.transitionApproval(id, 'reject', user);
  }

  async requestModification(
    id: number,
    payload: RequestModificationPayload,
    user?: OwnershipUser
  ): Promise<ApprovalStatusView> {
    return this.transitionApproval(
      id,
      'requestModification',
      user,
      payload.modifications,
      payload.note
    );
  }

  async resubmitApproval(id: number, user?: OwnershipUser): Promise<ApprovalStatusView> {
    return this.transitionApproval(id, 'resubmit', user);
  }

  private isApprovalPipelineConfigured(): boolean {
    return Boolean(
      this.approvalPipeline && this.approvalPipeline.enabled !== false
    );
  }

  private hasApprovalVisibilityFilter(): boolean {
    if (!this.isApprovalPipelineConfigured()) {
      return false;
    }
    const visible = this.approvalPipeline?.visibleStatuses;
    return Boolean(visible && visible.length > 0);
  }

  private getApprovalRepository(): Repository<ApprovalStatusEntity> {
    return this.repo.manager.getRepository(ApprovalStatusEntity);
  }

  private getHistoryRepository(): Repository<ModificationRequestHistoryEntity> {
    return this.repo.manager.getRepository(ModificationRequestHistoryEntity);
  }

  private async createWithApproval(
    resolved: ObjectLiteral,
    user?: OwnershipUser
  ): Promise<Entity> {
    const entity = await this.repo.manager.transaction(async (manager) => {
      const entityRepo = manager.getRepository(this.repo.target);
      const saved = await entityRepo.save(
        resolved as unknown as DeepPartial<Entity>
      );

      const approvalRepo = manager.getRepository(ApprovalStatusEntity);
      const approval = approvalRepo.create({
        entity: this.repo.metadata.tableName,
        entityId: String((saved as { id?: string | number }).id),
        status: APPROVAL_STATUS.pending,
        requestedBy: user?.id != null ? String(user.id) : null,
      });
      await approvalRepo.save(approval);

      return saved as unknown as Entity;
    });

    return entity;
  }

  private async resolveEntityForApproval(
    id: number,
    user?: OwnershipUser
  ): Promise<Entity | null> {
    if (this.enforceOwnershipFor(user)) {
      return this.findOwnedEntity(id, user as OwnershipUser);
    }
    return this.repo.findOneBy({ id } as unknown as Partial<Entity>);
  }

  private async loadApprovalStatus(
    id: number,
    user?: OwnershipUser
  ): Promise<ApprovalStatusEntity | null> {
    const entity = await this.resolveEntityForApproval(id, user);
    if (!entity) {
      return null;
    }

    const approval = await this.getApprovalRepository().findOneBy({
      entity: this.repo.metadata.tableName,
      entityId: String(id),
    });

    return approval ?? null;
  }

  private async transitionApproval(
    id: number,
    action: 'approve' | 'reject' | 'requestModification' | 'resubmit',
    user?: OwnershipUser,
    modifications?: ModificationItem[],
    note?: string
  ): Promise<ApprovalStatusView> {
    if (!this.isApprovalPipelineConfigured()) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_APPROVAL_NOT_CONFIGURED);
    }

    const permission = this.approvalPipeline?.permissions?.[action];
    if (permission && !this.userHasPermission(user, permission)) {
      throw keyed(
        HttpStatus.FORBIDDEN,
        ErrorKey.CRUD_APPROVAL_FORBIDDEN,
        { permission, action }
      );
    }

    const approval = await this.loadApprovalStatus(id, user);

    if (!approval) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    }

    const current = approval.status as ApprovalStatus;
    const now = new Date();
    const userId = user?.id != null ? String(user.id) : null;
    const transitionable = [
      APPROVAL_STATUS.pending,
      APPROVAL_STATUS.resubmitted,
    ];

    switch (action) {
      case 'approve':
        this.assertTransitionAllowed(action, current, transitionable);
        approval.status = APPROVAL_STATUS.approved;
        approval.decidedBy = userId;
        approval.decidedAt = now;
        approval.currentModifications = null;
        break;
      case 'reject':
        this.assertTransitionAllowed(action, current, transitionable);
        approval.status = APPROVAL_STATUS.rejected;
        approval.decidedBy = userId;
        approval.decidedAt = now;
        approval.currentModifications = null;
        break;
      case 'requestModification':
        this.assertTransitionAllowed(action, current, transitionable);
        approval.status = APPROVAL_STATUS.modificationRequested;
        approval.currentModifications = modifications ?? [];

        await this.getHistoryRepository().save(
          this.getHistoryRepository().create({
            approvalStatusId: approval.id,
            modifications: modifications ?? [],
            requestedBy: userId,
            note: note ?? null,
          })
        );
        break;
      case 'resubmit':
        if (current !== APPROVAL_STATUS.modificationRequested) {
          throw keyed(
            HttpStatus.BAD_REQUEST,
            ErrorKey.CRUD_APPROVAL_INVALID_TRANSITION,
            { action: 'resubmit', current: String(current) }
          );
        }
        approval.status = APPROVAL_STATUS.resubmitted;
        approval.currentModifications = null;
        approval.resubmittedBy = userId;
        approval.resubmittedAt = now;
        break;
    }

    const saved = await this.getApprovalRepository().save(approval);

    return this.toApprovalStatusView(saved);
  }

  private assertTransitionAllowed(
    action: string,
    current: ApprovalStatus,
    allowedFrom: readonly ApprovalStatus[]
  ): void {
    if (!allowedFrom.includes(current)) {
      throw keyed(
        HttpStatus.BAD_REQUEST,
        ErrorKey.CRUD_APPROVAL_INVALID_TRANSITION,
        { action, current: String(current) }
      );
    }
  }

  private userHasPermission(user: OwnershipUser | undefined, permission: string): boolean {
    if (!user) {
      return false;
    }
    const permissions = this.resolveUserPermissions(user);
    return permissions.includes(permission);
  }

  private applyApprovalVisibility(qb: SelectQueryBuilder<Entity>): void {
    if (!this.hasApprovalVisibilityFilter()) {
      return;
    }

    const visible = this.approvalPipeline?.visibleStatuses as readonly ApprovalStatus[];
    const tableName = this.repo.metadata.tableName;

    qb.innerJoin(
      ApprovalStatusEntity,
      'approvalStatus',
      `approvalStatus.entity = :approvalEntityName AND approvalStatus.entityId = ${this.approvalIdCastExpression()} AND approvalStatus.status IN (:...approvalVisibleStatuses)`,
      {
        approvalEntityName: tableName,
        approvalVisibleStatuses: [...visible],
      }
    );
  }

  private approvalIdCastExpression(): string {
    const type = this.repo.manager.connection.options.type;
    if (type === 'mysql' || type === 'mariadb' || type === 'aurora-mysql') {
      return 'CAST(e.id AS CHAR)';
    }
    if (type === 'better-sqlite3' || type === 'sqljs' || type === 'capacitor') {
      return 'CAST(e.id AS TEXT)';
    }
    return 'CAST(e.id AS varchar)';
  }

  private toApprovalStatusView(entity: ApprovalStatusEntity): ApprovalStatusView {
    return {
      id: entity.id,
      entity: entity.entity,
      entityId: entity.entityId,
      status: entity.status as ApprovalStatus,
      requestedBy: entity.requestedBy,
      requestedAt: entity.requestedAt,
      currentModifications: entity.currentModifications,
      decidedBy: entity.decidedBy,
      decidedAt: entity.decidedAt,
      resubmittedBy: entity.resubmittedBy,
      resubmittedAt: entity.resubmittedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toApprovalHistoryView(
    entity: ModificationRequestHistoryEntity
  ): ApprovalHistoryView {
    return {
      id: entity.id,
      approvalStatusId: entity.approvalStatusId,
      modifications: entity.modifications,
      requestedBy: entity.requestedBy,
      note: entity.note,
      requestedAt: entity.requestedAt,
    };
  }

  private async applyUpdateCore(
    id: number,
    payload: UpdateDto,
    user?: OwnershipUser
  ): Promise<ResponseDto> {
    let existing: Entity | null;

    if (this.enforceOwnershipFor(user)) {
      existing = await this.findOwnedEntity(id, user as OwnershipUser);
    } else {
      existing = await this.repo.findOneBy({
        id,
      } as unknown as Partial<Entity>);
    }

    if (!existing) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    }

    await this.executeHook(this.hooks.beforeUpdate, { payload, entity: existing, id });

    const transition = this.validateStatusTransition(
      existing,
      payload as unknown as Record<string, unknown>,
      user
    );

    const payloadSnapshot = { ...payload };
    const resolved = await this.resolveRelations(
      payload as unknown as ObjectLiteral
    );

    this.repo.merge(existing, resolved as DeepPartial<Entity>);
    await this.repo.save(existing);

    const result = await this.findOne(id, user);

    await this.executeHook(this.hooks.afterUpdate, { entity: result as any, payload: payloadSnapshot, id });

    if (transition) {
      await this.runTransitionActions(transition, id, existing, user);
    }

    return result;
  }

  async remove(id: number, user?: OwnershipUser) {
    let existing: Entity | null;

    if (this.enforceOwnershipFor(user)) {
      existing = await this.findOwnedEntity(id, user as OwnershipUser);
    } else {
      existing = await this.repo.findOneBy({
        id,
      } as unknown as Partial<Entity>);
    }

    if (!existing) {
      throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    }

    await this.executeHook(this.hooks.beforeRemove, { entity: existing, id });

    const result = await this.repo.delete(id);
    const deleted = result.affected !== 0;

    await this.executeHook(this.hooks.afterRemove, { id, deleted });

    return deleted;
  }

  async findAuditLogs(query: {
    user_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const qb = this.repo.manager
      .getRepository(AuditLogEntity)
      .createQueryBuilder('auditLog')
      .where('auditLog.entity = :entity', {
        entity: this.repo.metadata.name,
      })
      .orderBy('auditLog.createdAt', 'DESC');

    if (query.user_id) {
      qb.andWhere('auditLog.userId = :userId', {
        userId: query.user_id,
      });
    }

    if (query.start_date) {
      qb.andWhere('auditLog.createdAt >= :startDate', {
        startDate: new Date(query.start_date),
      });
    }

    if (query.end_date) {
      qb.andWhere('auditLog.createdAt <= :endDate', {
        endDate: new Date(query.end_date),
      });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
