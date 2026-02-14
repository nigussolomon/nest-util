import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { CreateAuditLogInput } from '../interfaces/audit-log.interface';

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
}
