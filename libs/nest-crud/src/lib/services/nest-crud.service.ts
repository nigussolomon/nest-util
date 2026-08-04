import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Type } from '@nestjs/common';
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
  applyCursorFilter,
  buildNextCursor,
  decodeCursor,
  detectCursorStrategy,
} from '../helpers/cursor-pagination.helper';

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
        throw new NotFoundException(`${String(relation.property)} not found`);
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
      throw new ForbiddenException(
        'Authentication required to access this resource'
      );
    }

    const qb = this.repo.createQueryBuilder('e');
    this.applyOwnershipCondition(qb, userId);
    qb.andWhere('e.id = :id', { id });
    this.applyIncludeJoins(qb);

    const rows = await qb.getMany();
    return rows[0] ?? null;
  }

  async findAll(query: PaginationDto & FilterDto) {
    const qb = this.repo.createQueryBuilder('e');

    this.applyIncludeJoins(qb);

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
      throw new BadRequestException('findMine not configured');
    }

    const qb = this.repo.createQueryBuilder('e');

    this.applyOwnershipCondition(qb, userId);

    this.applyIncludeJoins(qb);

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
      throw new NotFoundException('Resource not found');
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
        throw new ForbiddenException(
          'Authentication required to access this resource'
        );
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
          throw new NotFoundException('Resource not found');
        }
      } else {
        // Value absent — auto-set to the authenticated user
        (payload as Record<string, unknown>)[targetKey] = user.id;
        if (matchingRelation) {
          (payload as Record<string, unknown>)[field] = user.id;
        }
      }
    }

    await this.executeHook(this.hooks.beforeCreate, { payload });

    const payloadSnapshot = { ...payload };
    const resolved = await this.resolveRelations(
      payload as unknown as ObjectLiteral
    );

    const entity = await this.repo.save(resolved as unknown as Entity);

    const result = this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);

    await this.executeHook(this.hooks.afterCreate, { entity, payload: payloadSnapshot });

    return result;
  }

  async update(id: number, payload: UpdateDto, user?: OwnershipUser) {
    let existing: Entity | null;

    if (this.enforceOwnershipFor(user)) {
      existing = await this.findOwnedEntity(id, user as OwnershipUser);
    } else {
      existing = await this.repo.findOneBy({
        id,
      } as unknown as Partial<Entity>);
    }

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    await this.executeHook(this.hooks.beforeUpdate, { payload, entity: existing, id });

    const payloadSnapshot = { ...payload };
    const resolved = await this.resolveRelations(
      payload as unknown as ObjectLiteral
    );

    this.repo.merge(existing, resolved as DeepPartial<Entity>);
    await this.repo.save(existing);

    const result = await this.findOne(id, user);

    await this.executeHook(this.hooks.afterUpdate, { entity: result as any, payload: payloadSnapshot, id });

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
      throw new NotFoundException('Resource not found');
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
