import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../services/audit-log.service';
import { ListAuditLogsDto } from '../dtos/list-audit-logs.dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: ListAuditLogsDto) {
    return this.auditService.findAll({
      entity: query.entity,
      userId: query.user_id,
      startDate: query.start_date ? new Date(query.start_date) : undefined,
      endDate: query.end_date ? new Date(query.end_date) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }
}
