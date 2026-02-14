export interface CreateAuditLogInput {
  action: string;
  tenantId?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}
