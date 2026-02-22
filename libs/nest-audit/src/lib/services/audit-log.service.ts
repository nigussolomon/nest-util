import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { CreateAuditLogInput } from '../interfaces/audit-log.interface';

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
}
