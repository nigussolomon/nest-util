import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { CreateAuditLogInput } from '../interfaces/audit-log.interface';
import { CursorStrategy } from '../interfaces/cursor-strategy.interface';
import {
  applyCursorFilter,
  buildNextCursor,
  decodeCursor,
} from '../helpers/cursor-pagination.helper';

interface CursorPaginationQuery {
  cursor?: string;
  limit?: number;
  includeTotal?: boolean;
}

interface FindAuditLogsOptions {
  entity?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  private readonly cursorStrategy: CursorStrategy = {
    type: 'uuid',
    timestampColumn: 'createdAt',
  };

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>
  ) {}

  async log(input: CreateAuditLogInput): Promise<AuditLogEntity> {
    const entry = this.repo.create({
      action: input.action,
      tenantId: input.tenantId,
      entity: input.entity,
      entityId: input.entityId,
      userId: input.userId,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return this.repo.save(entry);
  }

  async logEntityAction(
    action: string,
    entity: string,
    entityId?: string,
    options?: Omit<CreateAuditLogInput, 'action' | 'entity' | 'entityId'>
  ) {
    return this.log({
      action,
      entity,
      entityId,
      ...options,
    });
  }

  async findAll(options: FindAuditLogsOptions = {}) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const queryBuilder = this.repo
      .createQueryBuilder('auditLog')
      .orderBy('auditLog.createdAt', 'DESC');

    if (options.entity) {
      queryBuilder.andWhere('auditLog.entity = :entity', {
        entity: options.entity,
      });
    }

    if (options.userId) {
      queryBuilder.andWhere('auditLog.userId = :userId', {
        userId: options.userId,
      });
    }

    if (options.startDate) {
      queryBuilder.andWhere('auditLog.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      queryBuilder.andWhere('auditLog.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

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

  async findAllWithCursor(
    query: CursorPaginationQuery & {
      entity?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const limit = query.limit ?? 10;
    const strategy = this.cursorStrategy;
    const orderDirection = 'DESC' as const;

    const qb = this.repo.createQueryBuilder('auditLog');

    if (query.entity) {
      qb.andWhere('auditLog.entity = :entity', {
        entity: query.entity,
      });
    }

    if (query.userId) {
      qb.andWhere('auditLog.userId = :userId', {
        userId: query.userId,
      });
    }

    if (query.startDate) {
      qb.andWhere('auditLog.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('auditLog.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor, strategy);
      applyCursorFilter(qb, decoded, strategy, orderDirection);
    }

    qb.orderBy('auditLog.createdAt', orderDirection);
    qb.addOrderBy('auditLog.id', orderDirection);

    const take = limit + 1;
    const entities = await qb.take(take).getMany();

    const hasMore = entities.length > limit;
    const data = hasMore ? entities.slice(0, limit) : entities;

    const nextCursor = hasMore ? buildNextCursor(data as unknown as Record<string, unknown>[], strategy) : null;

    let total: number | undefined;
    if (query.includeTotal) {
      const countQb = this.repo.createQueryBuilder('auditLog');

      if (query.entity) {
        countQb.andWhere('auditLog.entity = :entity', {
          entity: query.entity,
        });
      }

      if (query.userId) {
        countQb.andWhere('auditLog.userId = :userId', {
          userId: query.userId,
        });
      }

      if (query.startDate) {
        countQb.andWhere('auditLog.createdAt >= :startDate', {
          startDate: new Date(query.startDate),
        });
      }

      if (query.endDate) {
        countQb.andWhere('auditLog.createdAt <= :endDate', {
          endDate: new Date(query.endDate),
        });
      }

      total = await countQb.getCount();
    }

    const meta: Record<string, unknown> = {
      limit,
      hasMore,
      nextCursor,
    };

    if (total !== undefined) {
      meta.total = total;
    }

    return { data, meta };
  }
}
